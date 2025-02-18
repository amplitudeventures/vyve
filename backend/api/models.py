from django.db import models

# Create your models here.


class Phase(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return self.name
    
# class Prompt(models.Model):
#     name = models.CharField(max_length=255)
#     phase_index = models.IntegerField()
#     prompt = models.TextField()

class SubPhase(models.Model):
    name = models.CharField(max_length=255)
    # description = models.TextField()
    parent_phase_id = models.ForeignKey(Phase, on_delete=models.CASCADE, null=True, blank=True)
    # prompt_id = models.ForeignKey(Prompt, on_delete=models.CASCADE)
    dependencies = models.ManyToManyField('self', symmetrical=False, blank=True, null=True)
    prompt = models.TextField()


    def __str__(self):
        return self.name

class AnalysisResult(models.Model):
    sub_phase_id = models.ForeignKey(SubPhase, on_delete=models.CASCADE)
    result = models.TextField()
    status = models.CharField(max_length=255)
    error = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.sub_phase_id.name

