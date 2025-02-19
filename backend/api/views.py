from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from django.views.decorators.http import require_GET
# from django.views.decorators.csrf import csrf_exempt
from .models import Phase, SubPhase, AnalysisResult
import os
# Create your views here.
from django.http import HttpResponse
from .utils.pinecone_handler import PineconeHandler
import logging
from .utils.langchain_processor import LangChainProcessor
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

pinecone_handler = PineconeHandler(PINECONE_INDEX_NAME, PINECONE_API_KEY, PINECONE_ENVIRONMENT, OPENAI_API_KEY)
processor = LangChainProcessor(pinecone_handler)

def get_prompt_with_dependencies():
    # dependencies = sub_phase.dependencies.all()
    # prompt = sub_phase.prompt
    # for dependency in dependencies:
    #     prompt += f"\n\n{dependency.name}: {dependency.prompt}"
    completed_results = AnalysisResult.objects.filter(status='completed')
    completed_sub_phases = [result.sub_phase_id for result in completed_results]
    prompt = ""
    for sub_phase in completed_sub_phases:
        result = AnalysisResult.objects.filter(sub_phase_id=sub_phase, status='completed').first()
        if result:
            prompt += f"\n\n{sub_phase.name}: {result.result}"
    return prompt

def analyse_phase(phase_id=None):
    try:
        # FOR NOW ALWAYS USE THE FIRST PHASE
        if not phase_id:
                phase_id = Phase.objects.first().id
        phase = Phase.objects.filter(name="Initial Analytics").first()
        if not phase:
            logger.error(f"Phase not found: {phase_id}")
            return None
        
        sub_phases = SubPhase.objects.filter(parent_phase_id=phase)
        sub_phases_without_dependencies = []
        sub_phases_with_dependencies = []
        for sub_phase in sub_phases[:2]:
            # latest_result = AnalysisResult.objects.filter(sub_phase_id=sub_phase).order_by('-created_at').first()
            
            # TEMPORARY: REMEMBER TO REMOVE THIS
            AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()
            takesSummaries = sub_phase.takesSummaries
            latest_result = None
            if not latest_result and not takesSummaries:
                sub_phases_without_dependencies.append(sub_phase)
            elif not latest_result and takesSummaries:
                sub_phases_with_dependencies.append(sub_phase)
        print(f'length of incomplete sub phases without dependencies: {len(sub_phases_without_dependencies)}')
        print(f'length of sub phases with dependencies: {len(sub_phases_with_dependencies)}')
        print("--------------------------------")


        for sub_phase in sub_phases_without_dependencies:
            analysis_result = processor.analyze_phase(sub_phase.prompt)
            if analysis_result:
                print(f"Analysis result for {sub_phase.name}: {analysis_result[:100]}")

                # delete all previous analysis results for this sub phase
                AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()

                AnalysisResult.objects.create(
                    sub_phase_id=sub_phase,
                    status='completed',
                    result=analysis_result
                )
            else:
                print(f"No analysis result for {sub_phase.name}")
                
        for sub_phase in sub_phases_with_dependencies:
            prompt = get_prompt_with_dependencies()
            print(f"Prompt for {sub_phase.name}: {prompt}\n\n")
            # delete all previous analysis results for this sub phase
            AnalysisResult.objects.filter(sub_phase_id=sub_phase).delete()
            analysis_result = processor.analyze_phase(prompt)
            if analysis_result:
                print(f"Analysis result for {sub_phase.name}: {analysis_result[:100]}")
                AnalysisResult.objects.create(
                    sub_phase_id=sub_phase,
                    status='completed',
                    result=analysis_result
                )
            else:
                print(f"No analysis result for {sub_phase.name}")
        
    except Exception as err:
        logger.error(f'analyse_phse(): {err}')

@require_POST
def start_analysis(request):
    try:
        print(get_prompt_with_dependencies())
        phase_ids = [phase.id for phase in Phase.objects.all()]
        for id in phase_ids:
            analyse_phase(id)
        return JsonResponse({"message": phase_ids})
    except Exception as e:
        logger.error(f"Error: {e}")
        return JsonResponse({"error": str(e)}, status=500)


@require_GET
def get_phases(request):
    try:
        data = {}
        phases = Phase.objects.all()
        for phase in phases:
            phase_info = {
                    "sub_phases":{}
                    }
            sub_phases = phase.subphase_set.all()
            
            for sub_phase in sub_phases:
                analysis_inst = sub_phase.analysisresult_set.first()
                result = analysis_inst.result if analysis_inst else ""
                status = analysis_inst.status if analysis_inst else ""
                print(f'{sub_phase.name}\' result: {analysis_inst.result[:10]}') if result else print(f"{sub_phase.name} has not results!!!")
                sub_phase_info = {
                    f"{sub_phase.name}":{
                        "analysis_result": result,
                        'status': status
                        }
                    }
                phase_info['sub_phases'][sub_phase.name] = sub_phase_info
            data[f'{phase.name}'] = phase_info
        return JsonResponse({"phases": data})   
    except Exception as err:
        logger.error(err)
        JsonResponse({"error": f"/get_phases : {err}"})

@require_GET
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