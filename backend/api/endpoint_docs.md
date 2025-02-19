

/get_phases
"phases": {

    "phase_name1": {
        "name": "Phase Name"
        "id": 1,
        "subphases":{
            "subphase1":{
                "name": "sub_phase_name"
                "analysis_result": "RESULT",
                "status": "completed",
                "id": 1
            },
            "subphase2":{
                "analysis_result": "",
                "status": "pending",
                "id": 2
            },
            "subphase3":{
                "analysis_result": "",
                "status": "error",
                "id": 3
            }
            
        }
    },

    "phase_name2": {
        "id": 1,
        "subphases":{
            "subphase1":{
                "name": "sub_phase_name"
                "analysis_result": "RESULT",
                "status": "completed",
                "id": 1
            },
            "subphase2":{
                "name": "sub_phase_name"
                "analysis_result": "",
                "status": "pending",
                "id": 2
            },
            "subphase3":{
                "name": "sub_phase_name"
                "analysis_result": "",
                "status": "error",
                "id": 3
            }
            
        }
    }

}
