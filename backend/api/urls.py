from django.urls import path

from . import views

urlpatterns = [
    path("start_analysis/", views.start_analysis, name="start_analysis"),
    path("stop_analysis/", views.stop_analysis, name="stop_analysis"),
    path("get_analysis_status/", views.get_analysis_status, name="get_analysis_status"),
    path("get_analysis_results/", views.get_analysis_results, name="get_analysis_results"),
    path('get_phases/', views.get_phases, name="get_phases"),
    path('reset_analysis/', views.reset_analysis, name="reset_analysis"),
    path('upload_file/', views.upload_file, name="upload_file"),
    path('create_company/', views.create_company, name="create_company"),
    path('get_company_profiles/', views.get_company_profiles, name="get_company_profiles"),
]