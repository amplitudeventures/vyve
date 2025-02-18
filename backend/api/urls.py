from django.urls import path

from . import views

urlpatterns = [
    path("start_analysis/", views.start_analysis, name="start_analysis"),
    path("get_analysis_status/", views.get_analysis_status, name="get_analysis_status"),
    path("get_analysis_results/", views.get_analysis_results, name="get_analysis_results"),
]