from django.http import JsonResponse
# from django.views.decorators.http import require_GET, require_http_methods, require_POST
# from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from .models import Phase, SubPhase, AnalysisResult
import os
# Create your views here.
from django.http import HttpResponse
from .utils.pinecone_handler import PineconeHandler
import logging
from .utils.langchain_processor import LangChainProcessor
import json
from supabase import create_client
from .models import CompanyProfile, CompanyDocument
import uuid

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

try:
    pinecone_handler = PineconeHandler(PINECONE_INDEX_NAME, PINECONE_API_KEY, PINECONE_ENVIRONMENT, OPENAI_API_KEY)
    processor = LangChainProcessor(pinecone_handler)
    supabase_client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
except Exception as err:
    raise Exception(f"Error: {err}")

def get_prompt_with_dependencies(current_phase_prompt: str, phase: Phase):
    completed_results = AnalysisResult.objects.filter(status='completed')
    # Make sure we only include the completed sub phases that are before the current phase
    completed_sub_phases = [result.sub_phase_id for result in completed_results if result.sub_phase_id.parent_phase_id.order <= phase.order]
    prompt = f"""
        Prompt: {current_phase_prompt}

        {'-' * 40}
        Here are the results of the completed phases so far:
    """
    for sub_phase in completed_sub_phases:
        result = AnalysisResult.objects.filter(sub_phase_id=sub_phase, status='completed').first()
        if result:
            prompt += f"\n\n{sub_phase.name}: {result.result}"

    logger.info(f"Prompt with dependencies: \n\n{prompt}\n\n")
    return prompt

def reset_phases():
    """
    Resets the status of all phases to idle and deletes all analysis results
    """
    phases = Phase.objects.all()
    for phase in phases:
        phase.status = 'idle'
        phase.save()
    
    AnalysisResult.objects.all().delete()

status = ['idle', 'in_progress', 'completed', 'incomplete']

def analyse_phase(sub_phase_id, request):
    """
    Analyses a phase and all its sub phases
    """
    try:
        sub_phase = SubPhase.objects.get(id=sub_phase_id)
        result = AnalysisResult.objects.filter(sub_phase_id=sub_phase).first()
        if result:
            return result.result
        phase = sub_phase.parent_phase_id
        # where order is less than or equal to the sub phase's order
        previous_phases = Phase.objects.filter(order__lte=sub_phase.parent_phase_id.order)
        sub_phases = SubPhase.objects.filter(parent_phase_id__in=previous_phases)
    
        sub_phases_without_dependencies = []
        # sub_phases_with_dependencies = []
        for sub_phase in sub_phases:
            # latest_result = AnalysisResult.objects.filter(sub_phase_id=sub_phase).order_by('-created_at').first()
            
            # TEMPORARY: REMEMBER TO REMOVE THIS
            # AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()
            takesSummaries = sub_phase.takesSummaries
            latest_result = None
            if not latest_result and not takesSummaries:
                sub_phases_without_dependencies.append(sub_phase)
            # elif not latest_result and takesSummaries:
            #     sub_phases_with_dependencies.append(sub_phase)
        logger.info(f'\tlength of incomplete sub phases without dependencies: {len(sub_phases_without_dependencies)}')
        # logger.info(f'\tlength of sub phases with dependencies: {len(sub_phases_with_dependencies)}')
        # logger.info("-" * 100)

        phase_status = 'completed'

        temp_company_profile = CompanyProfile.objects.first()


        # Analyse the sub phases without dependencies first
        for sub_phase in sub_phases_without_dependencies:
            try:
                if request.session['stopAnalysis']:
                    logger.info(f"\t\tStopping analysis for {sub_phase.name}")
                    phase_status = 'incomplete'
                    break
                
                logger.info(f"\t\tAnalysing {sub_phase.name} | stopAnalysis: {request.session['stopAnalysis']}")
                analysis_result = processor.analyze_phase(sub_phase.prompt)
                if analysis_result:
                    print(f"Analysis result for {sub_phase.name}: {analysis_result[:100]}")

                    # Delete the existing analysis result
                    AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()

                    # Create a new analysis result
                    AnalysisResult.objects.create(
                        sub_phase_id=sub_phase,
                        company_profile=temp_company_profile,
                        status='completed',
                        result=analysis_result
                    )
                else:
                    print(f"No analysis result for {sub_phase.name}")
            except Exception as err:
                logger.error(f"Error analysing phase {sub_phase.name}: {err}")
                AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()

        prompt = get_prompt_with_dependencies(sub_phase.prompt, phase)
        analysis_result = processor.analyze_phase(prompt)
        if analysis_result:
            AnalysisResult.objects.create(
                sub_phase_id=sub_phase,
                company_profile=temp_company_profile,
                status='completed',
                result=analysis_result
            )
        return analysis_result
        # Set the phase to COMPLETED
        # phase.status = phase_status
        # phase.save()

    except Exception as err:
        logger.error(f'analyse_phse(): {err}')

def start_analysis(request):
    """
    Starts the analysis of all phases
    """

    try:
        if 'stopAnalysis' not in request.session:
            request.session['stopAnalysis'] = False

        data = request.POST.dict()
        sub_phase_id = data.get('id', None)
        company_id = data.get('company_id', None)
        if not sub_phase_id:
            return JsonResponse({"error": "Sub phase ID is required"}, status=400)
        
        # if not company_id or not CompanyProfile.objects.filter(id=company_id).exists():
        #     return JsonResponse({"error": "Company does not exist"}, status=400)
        
        # Pass this to the analyse_phase function so the results can be associated with the company, next up
        # company_profile = CompanyProfile.objects.get(id=company_id)
        
        # for phase in Phase.objects.all():
        result = analyse_phase(sub_phase_id, request)
        return JsonResponse({"result": result})
    except Exception as e:
        logger.error(f"Error: {e}")
        return JsonResponse({"error": str(e)}, status=500)

def stop_analysis(request):
    """
    Stops the analysis of all phases
    """
    try:
        request.session['stopAnalysis'] = True
        return JsonResponse({"message": "Analysis stopped"})
    except Exception as e:
        logger.error(f"Error: {e}")
        return JsonResponse({"error": str(e)}, status=500)

def reset_analysis(request):
    """
    Resets the analysis of all phases
    """
    try:
        reset_phases()
        return JsonResponse({"message": "Analysis reset"})
    except Exception as e:
        logger.error(f"Error: {e}")
        return JsonResponse({"error": str(e)}, status=500)

def get_phases(request):
    try:
        # print(f'session: {request.session.session_key}')

        data = {}
        phases = Phase.objects.all()
        for phase in phases:
            phase_info = {
                    "sub_phases":{}
                    }
            sub_phases = phase.subphase_set.all()
            
            for i, sub_phase in enumerate(sub_phases):
                analysis_inst = sub_phase.analysisresult_set.first()
                result = analysis_inst.result if analysis_inst else ""
                status = analysis_inst.status if analysis_inst else ""
                print(f'{sub_phase.name}\' result: {analysis_inst.result[:10]}') if result else print(f"{sub_phase.name} has no results!!!")
                sub_phase_info = {
                    "analysis_result": result,
                    'status': status,
                    'order': i,
                    'id': sub_phase.id
                }
                phase_info['sub_phases'][sub_phase.name] = sub_phase_info
            data[f'{phase.name}'] = phase_info
        return JsonResponse({"phases": data})   
    except Exception as err:
        logger.error(err)
        JsonResponse({"error": f"/get_phases : {err}"})


@csrf_exempt
def create_company(request):
    try:
        company_name = request.POST.get("company_name")

        if CompanyProfile.objects.filter(company_name=company_name).exists():
            return JsonResponse({"error": "Company already exists"}, status=400)
        
        CompanyProfile.objects.create(company_name=company_name)
        return JsonResponse({"message": "Company created successfully"})
    except Exception as err:
        logger.error(err)
        return JsonResponse({"error": f"/create_company : {err}"}, status=500)
    
@csrf_exempt
def upload_file(request):
    try:
        uploaded_file = request.FILES["file"]
        file_name = uploaded_file.name
        company_id = request.POST.get("company_id")
        if not CompanyProfile.objects.filter(id=company_id).exists():
            return JsonResponse({"error": "Company does not exist"}, status=400)
        
        company_profile = CompanyProfile.objects.get(id=company_id)
        
        # Read the file content
        file_content = uploaded_file.read()
        logger.info(f"\t\tFile name: {file_name}, content size: {len(file_content)}")
        upload_file = supabase_client.storage.from_("documents").upload(f"{uuid.uuid4()}_{file_name}", file_content)
        doc_path = upload_file.path
        
        CompanyDocument.objects.create(company_profile=company_profile, file_path=doc_path)
        return JsonResponse({"message": "File uploaded successfully"})

    except Exception as err:
        logger.error(err)
        return JsonResponse({"error": f"/create_user : {err}"}, status=500)


def get_analysis_status(request):
    # return JsonResponse({"message": "Analysis status"})
    
    phase_id = request.GET.get('phase_id')
    
    if not phase_id:
        return JsonResponse({'error': 'Phase ID is required'}, status=400)
    
    try:
        phase_id = int(phase_id)
        phase = Phase.objects.filter(id=phase_id).first() # get the phase object
        
        if not phase:
            return JsonResponse(
                {
                    'status': 'error',
                    'message': f'Result for phase {phase_id} not found'
                }
            )
        
        sub_phases = SubPhase.objects.filter(parent_phase_id=phase)
        phase_status = {
            'id': phase.id,
            'name': phase.name,
            'description': phase.description,
            'status': phase.status,
            'sub_phases': [] ,
            'overall_progress': 0,
            'total_sub_phases' : len(sub_phase)
        }
        
        completed_sub_phases = 0
        
        for sub_phase in sub_phases:
            latest_result = AnalysisResult.objects.filter(sub_phase_id=sub_phase).order_by('-created_at').first() # not sure how to order it
            
            dependencies = sub_phase.dependencies.all()
            dependencies_completed = all(
                AnalysisResult.objects.filter(
                    sub_phase_id=dep,
                    status='completed'
                    
                ).exists() for dep in dependencies
            )
            
            
            sub_phase_info = {
                'id': sub_phase.id,
                'name': sub_phase.name,
                'description': sub_phase.description,
                'dependencies_met': dependencies_completed,
                'can_start': dependencies_completed
            }
            
            if latest_result:
                sub_phase_info.update(
                    {
                        'status': latest_result.status,
                        'last_updated': latest_result.updated_at.isoformat(), # not sure if necessary
                        'result': latest_result.result if latest_result.status == 'completed' else None,
                        'error': latest_result.error if latest_result.status == 'failed' else None,
                        
                        # i dont know if necessary ,  a just incase 
                        'metadata' : {
                            'prompt' : sub_phase.prompt_id.prompt if sub_phase.prompt_id else None,
                            'created_at' : latest_result.created_at.isoformat(),
                            'duration' : (latest_result.updated_at - latest_result.created_at).total_seconds()
                        }
                    }
                )
                
                if latest_result.status == 'completed':
                    completed_sub_phases += 1
            
            else:
                sub_phase_info.update(
                    {
                        'status': 'pending',   
                        'metadata': {
                            'prompt' : sub_phase.prompt_id.prompt if sub_phase.prompt_id else None,
                        }                     
                    }
                )
            
            phase_status['sub_phases'].append(sub_phase_info)
            
        if completed_sub_phases > 0:
            phase_status['overall_progress'] = (completed_sub_phases / phase_status['total_sub_phases']) * 100
        
        if completed_sub_phases == sub_phase['total_sub_phases']:
            phase_status['status'] = 'completed'
        elif completed_sub_phases > 0:
            phase_status['status'] = 'in_progress'
        else:
            phase_status['status'] = 'pending'
            
        
            
        
        return JsonResponse(phase_status)
    
    except ValueError:
        return JsonResponse ({
            'error': 'Invalid phase ID'
        }, status=400)
        
    except Exception as e:
        return JsonResponse({
            'error': str(e)
        }, status=500)
        
async def get_analysis_status(request):
    return JsonResponse({"message": "Analysis status"})


async def get_analysis_results(request):
    return JsonResponse({"message": "Analysis results"})