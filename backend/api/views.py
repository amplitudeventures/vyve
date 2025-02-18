from django.shortcuts import render
from django.http import JsonResponse

from django.views.decorators.http import require_GET
# from django.views.decorators.csrf import csrf_exempt
from .models import Phase, SubPhase, AnalysisResult
import os
# Create your views here.
from django.http import HttpResponse
from .utils.pinecone_handler import PineconeHandler


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_ENVIRONMENT = os.getenv("PINECONE_ENVIRONMENT")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

pinecone_handler = PineconeHandler(PINECONE_INDEX_NAME, PINECONE_API_KEY, PINECONE_ENVIRONMENT, OPENAI_API_KEY)
async def start_analysis(request):
    message = pinecone_handler.query_similar("million metric tons")
    print(f"Message: {message}")
    return JsonResponse({"message": str(message)})


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