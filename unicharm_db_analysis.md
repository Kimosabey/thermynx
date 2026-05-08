# Unicharm Database Analysis

## Table: area

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| zone_id | varchar(36) | NO | MUL | NULL |  |


## Table: btm_0001110000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: btm_0001110000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: building

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| campus_id | varchar(36) | NO | MUL | NULL |  |


## Table: campus

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO | UNI | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| organization_id | varchar(36) | NO | MUL | NULL |  |


## Table: ch_0001b00000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ch_0001b00000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ch_0002b00000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ch_0002b00000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: chiller_1_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| evap_entering_temp | decimal(10,4) | YES |  | NULL |  |
| evap_leaving_temp | decimal(10,4) | YES |  | NULL |  |
| evap_flow | decimal(10,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| cond_entering_temp | decimal(10,4) | YES |  | NULL |  |
| cond_leaving_temp | decimal(10,4) | YES |  | NULL |  |
| cond_flow | decimal(10,4) | YES |  | NULL |  |
| ambient_temp | decimal(10,4) | YES |  | NULL |  |
| humidity_monitoring | decimal(10,4) | YES |  | NULL |  |
| btu_inlet_temp | decimal(10,4) | YES |  | NULL |  |
| btu_outlet_temp | decimal(10,4) | YES |  | NULL |  |
| chw_delta_t | decimal(10,4) | YES |  | NULL |  |
| tr | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| trh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_trh | decimal(20,4) | YES |  | NULL |  |
| kw_per_tr | decimal(10,4) | YES |  | NULL |  |
| btu_delta_t | decimal(10,4) | YES |  | NULL |  |
| wet_bulb_temp | decimal(10,4) | YES |  | NULL |  |
| chiller_load | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: chiller_2_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| evap_entering_temp | decimal(10,4) | YES |  | NULL |  |
| evap_leaving_temp | decimal(10,4) | YES |  | NULL |  |
| evap_flow | decimal(10,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| cond_entering_temp | decimal(10,4) | YES |  | NULL |  |
| cond_leaving_temp | decimal(10,4) | YES |  | NULL |  |
| cond_flow | decimal(10,4) | YES |  | NULL |  |
| ambient_temp | decimal(10,4) | YES |  | NULL |  |
| humidity_monitoring | decimal(10,4) | YES |  | NULL |  |
| btu_inlet_temp | decimal(10,4) | YES |  | NULL |  |
| btu_outlet_temp | decimal(10,4) | YES |  | NULL |  |
| chw_delta_t | decimal(10,4) | YES |  | NULL |  |
| tr | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| trh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_trh | decimal(20,4) | YES |  | NULL |  |
| kw_per_tr | decimal(10,4) | YES |  | NULL |  |
| btu_delta_t | decimal(10,4) | YES |  | NULL |  |
| wet_bulb_temp | decimal(10,4) | YES |  | NULL |  |
| chiller_load | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: coh_0001c00000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: coh_0001c00000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: cohw_0001c10000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: cohw_0001c10000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condenser_pump_0102_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: condenser_pump_03_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: condpu_0001b40000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condpu_0001b40000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condpu_0002b40000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condpu_0002b40000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condpu_0003b40000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: condpu_0003b40000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: cooling_tower_1_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| fan1_kw | decimal(10,4) | YES |  | NULL |  |
| fan2_kw | decimal(10,4) | YES |  | NULL |  |
| fan3_kw | decimal(10,4) | YES |  | NULL |  |
| F1_run_hours | decimal(10,4) | YES |  | NULL |  |
| F2_run_hours | decimal(10,4) | YES |  | NULL |  |
| F3_run_hours | decimal(10,4) | YES |  | NULL |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| fan1_kwh | decimal(10,4) | YES |  | NULL |  |
| fan2_kwh | decimal(10,4) | YES |  | NULL |  |
| fan3_kwh | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan1_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan2_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan3_kwh | decimal(20,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: cooling_tower_2_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| fan1_kw | decimal(10,4) | YES |  | NULL |  |
| fan2_kw | decimal(10,4) | YES |  | NULL |  |
| fan3_kw | decimal(10,4) | YES |  | NULL |  |
| F1_run_hours | decimal(10,4) | YES |  | NULL |  |
| F2_run_hours | decimal(10,4) | YES |  | NULL |  |
| F3_run_hours | decimal(10,4) | YES |  | NULL |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| fan1_kwh | decimal(10,4) | YES |  | NULL |  |
| fan2_kwh | decimal(10,4) | YES |  | NULL |  |
| fan3_kwh | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan1_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan2_kwh | decimal(20,4) | YES |  | NULL |  |
| cumulative_fan3_kwh | decimal(20,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: cpm_0001bc0000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: cpm_0001bc0000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ct_0001b70000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ct_0001b70000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ct_0002b70000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: ct_0002b70000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: daily_building_occupancy

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| building_id | varchar(36) | NO | MUL | NULL |  |
| occupancy | json | NO |  | NULL |  |
| avg_occupancy | int | YES |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: daily_floor_occupancy

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| floor_id | varchar(36) | NO | MUL | NULL |  |
| occupancy | json | NO |  | NULL |  |
| avg_occupancy | int | YES |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: daily_zone_occupancy

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| zone_id | varchar(36) | NO | MUL | NULL |  |
| occupancy | json | NO |  | NULL |  |
| avg_occupancy | int | YES |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: device

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO | UNI | NULL |  |
| type | varchar(45) | NO | MUL | NULL |  |
| mac | varchar(45) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| area_id | varchar(36) | NO | MUL | NULL |  |
| x | float | YES |  | NULL |  |
| y | float | YES |  | NULL |  |
| device_info | text | YES |  | NULL |  |


## Table: device_status

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| device_mac | varchar(45) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| command_id | varchar(255) | YES | UNI | NULL |  |
| counter | varchar(255) | YES |  | NULL |  |
| gatewayip | varchar(16) | YES |  | NULL |  |
| mode | varchar(255) | YES |  | NULL |  |
| intensity | varchar(255) | YES |  | NULL |  |
| payload | text | YES |  | NULL |  |
| status | varchar(255) | YES |  | NULL |  |
| batch_id | varchar(36) | YES |  | NULL |  |


## Table: em_0001000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0001000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0002000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0002000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0003000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0003000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0004000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0004000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0005000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0005000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0006000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0006000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0007000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0007000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0008000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0008000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0009000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_0009000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000a000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000a000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000b000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000b000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000c000000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: em_000c000000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: energy_daily_analytics

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint | NO | PRI | NULL | auto_increment |
| device_type | varchar(36) | NO | MUL | NULL |  |
| device_id | varchar(50) | NO |  | NULL |  |
| device_name | varchar(150) | NO |  | NULL |  |
| day_date | date | NO |  | NULL |  |
| energy_kwh | decimal(10,3) | NO |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: energy_hourly_analytics

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint | NO | PRI | NULL | auto_increment |
| device_type | varchar(36) | NO | MUL | NULL |  |
| device_id | varchar(50) | NO |  | NULL |  |
| device_name | varchar(150) | NO |  | NULL |  |
| hour_start | datetime | NO |  | NULL |  |
| energy_kwh | decimal(10,3) | NO |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: energy_weekly_analytics

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint | NO | PRI | NULL | auto_increment |
| device_type | varchar(36) | NO | MUL | NULL |  |
| device_id | varchar(50) | NO |  | NULL |  |
| device_name | varchar(150) | NO |  | NULL |  |
| week_start | date | NO |  | NULL |  |
| week_label | varchar(10) | NO |  | NULL |  |
| energy_kwh | decimal(10,3) | NO |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: event

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| device_id | varchar(36) | NO | MUL | NULL |  |
| device_type | varchar(45) | NO | MUL | NULL |  |
| data | text | NO |  | NULL |  |
| created_at | timestamp | YES | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: floor

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| building_id | varchar(36) | NO | MUL | NULL |  |
| type | varchar(9) | YES | MUL | NULL |  |
| floor_number | int | YES |  | NULL |  |


## Table: gateway

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO |  | NULL |  |
| ip | varchar(16) | NO | UNI | NULL |  |
| status | tinyint(1) | YES |  | 1 |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gateway_mapping

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| zone_id | varchar(36) | NO | MUL | NULL |  |
| gateway_id | varchar(36) | NO | MUL | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: generated_reports

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint | NO | PRI | NULL | auto_increment |
| file_path | varchar(255) | YES |  | NULL |  |
| from_time | datetime | YES |  | NULL |  |
| to_time | datetime | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: gl_access

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| access_name | varchar(100) | NO |  | NULL |  |
| is_active | tinyint(1) | YES |  | 1 |  |


## Table: gl_alarm

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| validate | tinyint(1) | YES |  | 0 |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| alarm_code | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES |  | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| message | text | YES |  | NULL |  |
| acknowledged | tinyint(1) | YES |  | 0 |  |
| acknowledged_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| restore | tinyint(1) | YES |  | 0 |  |
| restored_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| delete_alarm | tinyint(1) | YES |  | 0 |  |
| deleted_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| user_id | varchar(36) | YES |  | NULL |  |
| possible_causes | text | YES |  | NULL |  |
| name | varchar(36) | YES |  | NULL |  |
| tag | varchar(36) | YES |  | NULL |  |
| description | varchar(36) | YES |  | NULL |  |
| source | varchar(36) | YES |  | NULL |  |
| technician_feedback | text | YES |  | NULL |  |


## Table: gl_all_type

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| type | varchar(256) | YES | UNI | NULL |  |
| name | varchar(256) | YES |  | NULL |  |
| tag | varchar(256) | YES |  | NULL |  |
| description | varchar(1024) | YES |  | NULL |  |
| referring_table | varchar(256) | YES |  | NULL |  |


## Table: gl_control_command

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| targert_id | varchar(36) | YES |  | NULL |  |
| target_type | varchar(36) | YES |  | NULL |  |
| ss_id | varchar(36) | YES |  | NULL |  |
| ss_type | varchar(36) | YES |  | NULL |  |
| zone_type | varchar(36) | YES |  | NULL |  |
| zone_id | varchar(36) | YES |  | NULL |  |
| gl_command | varchar(36) | NO |  | NULL |  |
| param_id | varchar(36) | NO |  | NULL |  |
| param_value | varchar(36) | NO |  | NULL |  |
| priority | int | YES |  | 8 |  |
| triggered_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| status | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_ibms_event

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| category | varchar(36) | NO |  | NULL |  |
| ss_id | varchar(36) | YES |  | NULL |  |
| event_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES |  | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| description | varchar(36) | YES |  | NULL |  |
| triggering_user | varchar(36) | YES |  | NULL |  |
| alarm_id | varchar(36) | YES |  | NO_ALARM |  |
| criticality | varchar(36) | YES |  | GL_EVENT_CRITICALITY_LOW |  |
| open_close | varchar(36) | YES |  | GL_EVENT_STATUS_OPEN |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_location

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | qw |  |
| name | varchar(256) | YES |  | NULL |  |
| zone_tag | varchar(256) | YES |  | NULL |  |
| description | varchar(1024) | YES |  | NULL |  |
| zone_shape | enum('rect','circle','poly','GL_LOCATION_SHAPE_DEFAULT') | YES |  | rect |  |
| zone_type | varchar(256) | YES | MUL | NULL |  |
| zone_status | enum('GL_LOCATION_STATUS_ACTIVE','GL_LOCATION_STATUS_INACTIVE') | YES |  | GL_LOCATION_STATUS_ACTIVE |  |
| zone_parent | varchar(36) | YES |  | NULL |  |
| coordinates | varchar(1024) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_location_input_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| zone_id | varchar(36) | YES | MUL | NULL |  |
| triggered_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_location_output_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| zone_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_location_scheduled_service_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| zone_id | varchar(36) | YES | MUL | NULL |  |
| schedule_id | varchar(36) | YES | MUL | NULL |  |


## Table: gl_location_subsystem_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| zone_id | varchar(36) | YES | MUL | NULL |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_location_user

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| zone_id | varchar(36) | NO |  | NULL |  |
| user_id | varchar(36) | NO |  | NULL |  |
| usage_start_time | timestamp | NO |  | NULL |  |
| usage_end_time | timestamp | NO |  | NULL |  |


## Table: gl_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(256) | NO | PRI | NULL |  |
| name | varchar(256) | YES |  | NULL |  |
| tag | varchar(256) | YES |  | NULL |  |
| description | varchar(1024) | YES |  | NULL |  |
| unit | varchar(256) | YES |  | NULL |  |
| unit_display | varchar(64) | YES |  | NULL |  |
| ss_type | varchar(256) | YES |  | NULL |  |
| time_window | varchar(36) | YES |  | NULL |  |
| computing_methodology | varchar(256) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_parameter

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(256) | NO | PRI | NULL |  |
| name | varchar(256) | YES |  | NULL |  |
| tag | varchar(256) | YES |  | NULL |  |
| description | varchar(1024) | YES |  | NULL |  |
| unit | varchar(256) | YES | MUL | NULL |  |
| unit_display | varchar(64) | YES |  | NULL |  |


## Table: gl_pas_res

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| trigger_id | varchar(36) | NO |  | NULL |  |
| Alarm_id | varchar(36) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_role

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| is_active | tinyint(1) | NO |  | 1 |  |
| name | varchar(255) | NO |  | NULL |  |
| discription | varchar(255) | YES |  | NULL |  |


## Table: gl_role_access

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| role_id | int | NO | MUL | NULL |  |
| access_id | int | NO | MUL | NULL |  |


## Table: gl_schedule

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(255) | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| description | varchar(100) | YES |  | NULL |  |
| cron_tab_fields | varchar(100) | YES |  | NULL |  |
| is_active | tinyint(1) | YES |  | 1 |  |
| start | datetime | NO |  | NULL |  |
| end | datetime | NO |  | NULL |  |
| referenceId | varchar(36) | YES |  | NULL |  |
| type | enum('start','end') | YES |  | NULL |  |


## Table: gl_schedule_detail

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| schedule_id | varchar(256) | YES | MUL | NULL |  |
| target_id | varchar(256) | YES |  | NULL |  |
| target_type | varchar(256) | YES | MUL | NULL |  |
| zone_id | varchar(1024) | YES |  | NULL |  |
| zone_type | varchar(36) | YES |  | NULL |  |
| ss_id | varchar(1024) | YES |  | NULL |  |
| ss_type | varchar(36) | YES |  | NULL |  |
| command | varchar(256) | YES |  | NULL |  |
| arguments | varchar(256) | YES |  | NULL |  |
| is_active | tinyint(1) | YES |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| param_name | varchar(255) | YES |  | NULL |  |
| param_value | varchar(255) | YES |  | NULL |  |
| priority | int | YES |  | NULL |  |
| name | varchar(255) | NO |  | NULL |  |


## Table: gl_schedule_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| zone_id | varchar(36) | YES | MUL | NULL |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| time_id | varchar(36) | YES | MUL | NULL |  |
| schedule_status | enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') | YES |  | GL_SS_STATUS_ACTIVE |  |
| recurring_status | enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') | YES |  | GL_SS_STATUS_ACTIVE |  |
| arguments | json | NO |  | NULL |  |
| schedule_type | varchar(256) | YES |  | NULL |  |
| expected_status | varchar(255) | YES |  | pending |  |
| name | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_subsystem

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | qw |  |
| name | varchar(256) | YES |  | NULL |  |
| ss_tag | varchar(256) | YES |  | NULL |  |
| description | varchar(1024) | YES |  | NULL |  |
| ss_type | varchar(256) | YES | MUL | NULL |  |
| ss_shape | enum('rect','circle','poly','GL_ZONE_SHAPE_DEFAULT') | YES |  | rect |  |
| ss_status | enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') | YES |  | GL_SS_STATUS_ACTIVE |  |
| ss_address_type | varchar(256) | YES | MUL | NULL |  |
| ss_address_value | varchar(1024) | YES |  | NULL |  |
| ss_parent | varchar(36) | YES |  | NULL |  |
| coordinates | varchar(1024) | YES |  | [0,0] |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_subsystem_detail

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| param_name | varchar(255) | YES |  | NULL |  |
| param_value | varchar(255) | YES |  | NULL |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |


## Table: gl_subsystem_input_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | YES |  | NULL |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| triggered_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| user_id | varchar(36) | YES |  | NULL |  |


## Table: gl_subsystem_latest_event

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_subsystem_output_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_subsystem_process_map

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| process_id | varchar(36) | YES |  | NULL |  |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| status | varchar(255) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_timestamp

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| start | tinytext | YES |  | NULL |  |
| end | tinytext | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: gl_user

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| user_id | varchar(36) | NO | UNI | NULL |  |
| is_active | tinyint(1) | NO |  | 1 |  |
| name | varchar(255) | NO |  | NULL |  |
| description | varchar(255) | YES |  | NULL |  |
| user_type | varchar(36) | YES |  | NULL |  |
| email_id | varchar(255) | YES | UNI | NULL |  |
| phone_no | varchar(10) | YES | UNI | NULL |  |
| login_id | varchar(36) | NO | UNI | NULL |  |
| password | varchar(180) | NO |  | NULL |  |
| registered_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| last_login | timestamp | YES |  | NULL |  |


## Table: gl_user_role

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| user_id | varchar(36) | NO | MUL | NULL |  |
| role_id | int | NO | MUL | NULL |  |


## Table: gl_user_session

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| user_id | varchar(36) | NO |  | NULL |  |
| token | text | NO |  | NULL |  |
| is_active | tinyint(1) | NO |  | 1 |  |


## Table: hvac_recurring_schedule

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO | UNI | NULL |  |
| data | json | NO |  | NULL |  |
| status | tinyint(1) | YES |  | 0 |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| floor_id | varchar(36) | NO | MUL | NULL |  |
| floor_name | varchar(36) | NO |  | NULL |  |
| start | datetime | NO |  | NULL |  |
| end | datetime | NO |  | NULL |  |


## Table: hvac_schedule

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO | UNI | NULL |  |
| data | json | NO |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| floor_id | varchar(36) | NO | MUL | NULL |  |
| floor_name | varchar(36) | NO |  | NULL |  |
| start | datetime | NO |  | NULL |  |
| end | datetime | NO |  | NULL |  |


## Table: latest_command

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| mode | varchar(120) | NO |  | NULL |  |
| intensity | int | NO |  | NULL |  |
| mac_id | varchar(120) | NO |  | NULL |  |
| data | text | NO |  | NULL |  |
| gatewayip | varchar(16) | YES |  | NULL |  |
| created_at | timestamp | NO | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: latest_event

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| device_id | varchar(36) | NO | UNI | NULL |  |
| device_name | varchar(120) | NO | MUL | NULL |  |
| device_type | varchar(45) | NO | MUL | NULL |  |
| data | text | NO |  | NULL |  |
| network_data | text | NO |  | NULL |  |
| created_at | timestamp | NO | MUL | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |
| area_id | varchar(36) | NO | MUL | NULL |  |
| zone_id | varchar(36) | NO | MUL | NULL |  |
| floor_id | varchar(36) | NO | MUL | NULL |  |
| building_id | varchar(36) | NO | MUL | NULL |  |
| campus_id | varchar(36) | NO | MUL | NULL |  |
| campus_name | varchar(120) | YES |  | NULL |  |
| building_name | varchar(120) | YES |  | NULL |  |
| floor_name | varchar(120) | YES |  | NULL |  |
| zone_name | varchar(120) | YES |  | NULL |  |
| area_name | varchar(120) | YES |  | NULL |  |
| floor_number | int | YES |  | NULL |  |


## Table: mwp0001150000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: mwp0001150000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: mwp0002150000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: mwp0002150000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: one_month_data

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: organization

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| name | varchar(120) | NO | UNI | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| updated_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: parking_status

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | varchar(36) | NO | PRI | NULL |  |
| context_id | varchar(36) | NO |  | NULL |  |
| total | int | NO |  | NULL |  |
| availability | int | YES |  | NULL |  |
| occupied | int | YES |  | NULL |  |
| created_at | timestamp | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: plant_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| slot_time | datetime | NO | UNI | NULL |  |
| total_kw | decimal(10,4) | YES |  | 0.0000 |  |
| total_kwh | decimal(10,4) | YES |  | 0.0000 |  |
| cumulative_kwh | decimal(20,4) | YES |  | 0.0000 |  |
| total_tr | decimal(10,4) | YES |  | 0.0000 |  |
| total_trh | decimal(10,4) | YES |  | 0.0000 |  |
| cumulative_trh | decimal(20,4) | YES |  | 0.0000 |  |
| aux_kw | decimal(10,4) | YES |  | 0.0000 |  |
| aux_kwh | decimal(10,4) | YES |  | 0.0000 |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: primary_pump_1_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: primary_pump_2_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: primary_pump_3_normalized

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | bigint unsigned | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | NO |  | NULL |  |
| slot_time | datetime | NO | UNI | NULL |  |
| is_running | tinyint(1) | NO |  | 0 |  |
| kw | decimal(10,4) | YES |  | NULL |  |
| run_hours | decimal(10,4) | YES |  | NULL |  |
| kwh | decimal(10,4) | YES |  | NULL |  |
| cumulative_kwh | decimal(20,4) | YES |  | NULL |  |
| created_at | datetime | NO |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |


## Table: priseq_0001cb0000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: priseq_0001cb0000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: pv_0001b20000_metric

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES |  | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| metric_id | varchar(36) | YES |  | NULL |  |
| metric_value | varchar(36) | YES |  | NULL |  |
| metric_minimum | varchar(36) | YES |  | NULL |  |
| metric_average | varchar(36) | YES |  | NULL |  |
| metric_maximum | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


## Table: pv_0001b20000_om_p

| Field | Type | Null | Key | Default | Extra |
|-------|------|------|-----|---------|-------|
| id | int | NO | PRI | NULL | auto_increment |
| ss_id | varchar(36) | YES | MUL | NULL |  |
| measured_time | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| param_id | varchar(36) | YES | MUL | NULL |  |
| param_value | varchar(36) | YES |  | NULL |  |
| created_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED |
| modified_at | timestamp | YES |  | CURRENT_TIMESTAMP | DEFAULT_GENERATED on update CURRENT_TIMESTAMP |


