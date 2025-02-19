from rest_framework import serializers
from .models import Prompt, SubPhase

class PromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prompt
        fields = ['id', 'name', 'phase_index', 'prompt'] 