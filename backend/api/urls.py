from django.urls import path

from . import views

urlpatterns = [
    path("start_analysis/", views.start_analysis, name="start_analysis"),
    path("stop_analysis/", views.stop_analysis, name="stop_analysis"),
    path("get_analysis_status/", views.get_analysis_status, name="get_analysis_status"),
    path("get_analysis_results/", views.get_analysis_results, name="get_analysis_results"),
    path('get_phases/', views.get_phases, name="get_phases"),
    path('reset_analysis/', views.reset_analysis, name="reset_analysis"),
]