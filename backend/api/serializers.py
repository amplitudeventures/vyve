from rest_framework import serializers
from .models import SubPhase, CompanyProfile, AnalysisResult

# class PromptSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Prompt
#         fields = ['id', 'name', 'phase_index', 'prompt'] 

class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = ['id', 'company_name']

# class AnalysisResultSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = AnalysisResult
#         fields = ['id', 'sub_phase_id', 'result', 'status', 'error', 'created_at', 'updated_at']