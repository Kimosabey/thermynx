# Unicharm Database DDL

## Table: area

```sql
CREATE TABLE `area` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `zone_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_area_zone_idx` (`zone_id`),
  CONSTRAINT `fk_area_floor` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: btm_0001110000_metric

```sql
CREATE TABLE `btm_0001110000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: btm_0001110000_om_p

```sql
CREATE TABLE `btm_0001110000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=190278 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: building

```sql
CREATE TABLE `building` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `campus_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_building_campus_idx` (`campus_id`),
  CONSTRAINT `fk_building_campus` FOREIGN KEY (`campus_id`) REFERENCES `campus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: campus

```sql
CREATE TABLE `campus` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `organization_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`),
  KEY `fk_campus_organization_idx` (`organization_id`),
  CONSTRAINT `fk_campus_organization` FOREIGN KEY (`organization_id`) REFERENCES `organization` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ch_0001b00000_metric

```sql
CREATE TABLE `ch_0001b00000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=728137 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ch_0001b00000_om_p

```sql
CREATE TABLE `ch_0001b00000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1094170 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ch_0002b00000_metric

```sql
CREATE TABLE `ch_0002b00000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=728411 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ch_0002b00000_om_p

```sql
CREATE TABLE `ch_0002b00000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1017632 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: chiller_1_normalized

```sql
CREATE TABLE `chiller_1_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Act_Pwr_Total',
  `evap_entering_temp` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CH_Entering_Chilled_Lqd_Temp',
  `evap_leaving_temp` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CH_Leaving_Chilled_Lqd_Temp',
  `evap_flow` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Flow_Meter_Eva_1',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Operating_hrs',
  `cond_entering_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Entering_CDW_Lqd_Temp',
  `cond_leaving_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Leaving_CDW_Lqd_Temp',
  `cond_flow` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Flow_Meter_CD_1',
  `ambient_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of AMBIENT_TEMP',
  `humidity_monitoring` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of HUMIDITY_MONITORING',
  `btu_inlet_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Btu_Meter_Inlet_Temp',
  `btu_outlet_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Btu_Meter_Outlet_Temp',
  `chw_delta_t` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: evap_entering_temp - evap_leaving_temp',
  `tr` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: evap_flow * (evap_entering_temp - evap_leaving_temp) * 0.33',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes  / 60',
  `trh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: tr * on_minutes  / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `cumulative_trh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_trh + trh',
  `kw_per_tr` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw / tr',
  `btu_delta_t` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: btu_outlet_temp - btu_inlet_temp',
  `wet_bulb_temp` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: ambient_temp * Math.atan(0.151977 * Math.sqrt(humidity_monitoring + 8.313659)) + Math.atan(ambient_temp + humidity_monitoring) - Math.atan(humidity_monitoring - 1.676331) + 0.00391838 * Math.pow(humidity_monitoring, 1.5) * Math.atan(0.023101 * humidity_monitoring) - 4.686035',
  `chiller_load` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: (tr/550)*100',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1723 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized chiller data for chiller_1'
```

## Table: chiller_2_normalized

```sql
CREATE TABLE `chiller_2_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Act_Pwr_Total',
  `evap_entering_temp` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CH_Entering_Chilled_Lqd_Temp',
  `evap_leaving_temp` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CH_Leaving_Chilled_Lqd_Temp',
  `evap_flow` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Flow_Meter_Eva_1',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Operating_hrs',
  `cond_entering_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Entering_CDW_Lqd_Temp',
  `cond_leaving_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CH_Leaving_CDW_Lqd_Temp',
  `cond_flow` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Flow_Meter_CD_1',
  `ambient_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of AMBIENT_TEMP',
  `humidity_monitoring` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of HUMIDITY_MONITORING',
  `btu_inlet_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Btu_Meter_Inlet_Temp',
  `btu_outlet_temp` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of Btu_Meter_Outlet_Temp',
  `chw_delta_t` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: evap_entering_temp - evap_leaving_temp',
  `tr` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: evap_flow * (evap_entering_temp - evap_leaving_temp) * 0.33',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes  / 60',
  `trh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: tr * on_minutes  / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `cumulative_trh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_trh + trh',
  `kw_per_tr` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw / tr',
  `btu_delta_t` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: btu_outlet_temp - btu_inlet_temp',
  `wet_bulb_temp` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: ambient_temp * Math.atan(0.151977 * Math.sqrt(humidity_monitoring + 8.313659)) + Math.atan(ambient_temp + humidity_monitoring) - Math.atan(humidity_monitoring - 1.676331) + 0.00391838 * Math.pow(humidity_monitoring, 1.5) * Math.atan(0.023101 * humidity_monitoring) - 4.686035',
  `chiller_load` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: (tr/550)*100',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1720 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized chiller data for chiller_2'
```

## Table: coh_0001c00000_metric

```sql
CREATE TABLE `coh_0001c00000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: coh_0001c00000_om_p

```sql
CREATE TABLE `coh_0001c00000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=606156 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: cohw_0001c10000_metric

```sql
CREATE TABLE `cohw_0001c10000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: cohw_0001c10000_om_p

```sql
CREATE TABLE `cohw_0001c10000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23222 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condenser_pump_0102_normalized

```sql
CREATE TABLE `condenser_pump_0102_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Act_Pwr_Total',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: on_minutes / 60 / 2',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1719 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized condenser_pump data for condenser_pump_0102'
```

## Table: condenser_pump_03_normalized

```sql
CREATE TABLE `condenser_pump_03_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of Act_Pwr_Total',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: on_minutes / 60',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1720 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized condenser_pump data for condenser_pump_03'
```

## Table: condpu_0001b40000_metric

```sql
CREATE TABLE `condpu_0001b40000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1855 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condpu_0001b40000_om_p

```sql
CREATE TABLE `condpu_0001b40000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=93024 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condpu_0002b40000_metric

```sql
CREATE TABLE `condpu_0002b40000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1855 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condpu_0002b40000_om_p

```sql
CREATE TABLE `condpu_0002b40000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=92987 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condpu_0003b40000_metric

```sql
CREATE TABLE `condpu_0003b40000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1855 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: condpu_0003b40000_om_p

```sql
CREATE TABLE `condpu_0003b40000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=93025 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: cooling_tower_1_normalized

```sql
CREATE TABLE `cooling_tower_1_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `fan1_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_1_Motor_Power',
  `fan2_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_2_Motor_Power',
  `fan3_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_3_Motor_Power',
  `F1_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_1_Running_Hrs',
  `F2_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_2_Running_Hrs',
  `F3_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_3_Running_Hrs',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kw + fan2_kw + fan3_kw',
  `fan1_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kw * on_minutes / 60',
  `fan2_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan2_kw * on_minutes / 60',
  `fan3_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan3_kw * on_minutes / 60',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kwh + fan2_kwh + fan3_kwh',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `cumulative_fan1_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan1_kwh + fan1_kwh',
  `cumulative_fan2_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan2_kwh + fan2_kwh',
  `cumulative_fan3_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan3_kwh + fan3_kwh',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: F1_run_hours + F2_run_hours + F3_run_hours',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1711 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized cooling_tower data for cooling_tower_1'
```

## Table: cooling_tower_2_normalized

```sql
CREATE TABLE `cooling_tower_2_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `fan1_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_1_Motor_Power',
  `fan2_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_2_Motor_Power',
  `fan3_kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of CT_Var_Fan_3_Motor_Power',
  `F1_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_1_Running_Hrs',
  `F2_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_2_Running_Hrs',
  `F3_run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of CT_Var_Fan_3_Running_Hrs',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kw + fan2_kw + fan3_kw',
  `fan1_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kw * on_minutes / 60',
  `fan2_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan2_kw * on_minutes / 60',
  `fan3_kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan3_kw * on_minutes / 60',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: fan1_kwh + fan2_kwh + fan3_kwh',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `cumulative_fan1_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan1_kwh + fan1_kwh',
  `cumulative_fan2_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan2_kwh + fan2_kwh',
  `cumulative_fan3_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_fan3_kwh + fan3_kwh',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: F1_run_hours + F2_run_hours + F3_run_hours',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1712 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized cooling_tower data for cooling_tower_2'
```

## Table: cpm_0001bc0000_metric

```sql
CREATE TABLE `cpm_0001bc0000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=38205 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: cpm_0001bc0000_om_p

```sql
CREATE TABLE `cpm_0001bc0000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=109447 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ct_0001b70000_metric

```sql
CREATE TABLE `ct_0001b70000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=348351 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ct_0001b70000_om_p

```sql
CREATE TABLE `ct_0001b70000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1618785 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ct_0002b70000_metric

```sql
CREATE TABLE `ct_0002b70000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=479601 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: ct_0002b70000_om_p

```sql
CREATE TABLE `ct_0002b70000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1620869 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: daily_building_occupancy

```sql
CREATE TABLE `daily_building_occupancy` (
  `id` int NOT NULL AUTO_INCREMENT,
  `building_id` varchar(36) NOT NULL,
  `occupancy` json NOT NULL,
  `avg_occupancy` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_occupancy_building_day` (`building_id`),
  CONSTRAINT `fk_occupancy_building_day` FOREIGN KEY (`building_id`) REFERENCES `building` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: daily_floor_occupancy

```sql
CREATE TABLE `daily_floor_occupancy` (
  `id` int NOT NULL AUTO_INCREMENT,
  `floor_id` varchar(36) NOT NULL,
  `occupancy` json NOT NULL,
  `avg_occupancy` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_occupancy_floor_day` (`floor_id`),
  CONSTRAINT `fk_occupancy_floor_day` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: daily_zone_occupancy

```sql
CREATE TABLE `daily_zone_occupancy` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone_id` varchar(36) NOT NULL,
  `occupancy` json NOT NULL,
  `avg_occupancy` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_occupancy_zone_day` (`zone_id`),
  CONSTRAINT `fk_occupancy_zone_day` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: device

```sql
CREATE TABLE `device` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` varchar(45) NOT NULL,
  `mac` varchar(45) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `area_id` varchar(36) NOT NULL,
  `x` float DEFAULT NULL,
  `y` float DEFAULT NULL,
  `device_info` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`),
  UNIQUE KEY `id_index` (`id`),
  KEY `fk_device_area_idx` (`area_id`),
  KEY `device_type_area_id_idx` (`type`,`area_id`),
  CONSTRAINT `fk_device_area` FOREIGN KEY (`area_id`) REFERENCES `area` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: device_status

```sql
CREATE TABLE `device_status` (
  `id` varchar(36) NOT NULL,
  `device_mac` varchar(45) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `command_id` varchar(255) DEFAULT NULL,
  `counter` varchar(255) DEFAULT NULL,
  `gatewayip` varchar(16) DEFAULT NULL,
  `mode` varchar(255) DEFAULT NULL,
  `intensity` varchar(255) DEFAULT NULL,
  `payload` text,
  `status` varchar(255) DEFAULT NULL,
  `batch_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `command_id` (`command_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0001000000_metric

```sql
CREATE TABLE `em_0001000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60627 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0001000000_om_p

```sql
CREATE TABLE `em_0001000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=644452 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0002000000_metric

```sql
CREATE TABLE `em_0002000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60477 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0002000000_om_p

```sql
CREATE TABLE `em_0002000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=500650 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0003000000_metric

```sql
CREATE TABLE `em_0003000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0003000000_om_p

```sql
CREATE TABLE `em_0003000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=954578 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0004000000_metric

```sql
CREATE TABLE `em_0004000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0004000000_om_p

```sql
CREATE TABLE `em_0004000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=875331 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0005000000_metric

```sql
CREATE TABLE `em_0005000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0005000000_om_p

```sql
CREATE TABLE `em_0005000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1091750 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0006000000_metric

```sql
CREATE TABLE `em_0006000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=60749 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0006000000_om_p

```sql
CREATE TABLE `em_0006000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=666023 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0007000000_metric

```sql
CREATE TABLE `em_0007000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=109657 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0007000000_om_p

```sql
CREATE TABLE `em_0007000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=531619 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0008000000_metric

```sql
CREATE TABLE `em_0008000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0008000000_om_p

```sql
CREATE TABLE `em_0008000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=831111 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0009000000_metric

```sql
CREATE TABLE `em_0009000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_0009000000_om_p

```sql
CREATE TABLE `em_0009000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=614519 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000a000000_metric

```sql
CREATE TABLE `em_000a000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000a000000_om_p

```sql
CREATE TABLE `em_000a000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=527547 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000b000000_metric

```sql
CREATE TABLE `em_000b000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000b000000_om_p

```sql
CREATE TABLE `em_000b000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=536684 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000c000000_metric

```sql
CREATE TABLE `em_000c000000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: em_000c000000_om_p

```sql
CREATE TABLE `em_000c000000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=590714 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: energy_daily_analytics

```sql
CREATE TABLE `energy_daily_analytics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_type` varchar(36) NOT NULL,
  `device_id` varchar(50) NOT NULL,
  `device_name` varchar(150) NOT NULL,
  `day_date` date NOT NULL,
  `energy_kwh` decimal(10,3) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_day` (`device_type`,`device_id`,`day_date`)
) ENGINE=InnoDB AUTO_INCREMENT=297 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: energy_hourly_analytics

```sql
CREATE TABLE `energy_hourly_analytics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_type` varchar(36) NOT NULL,
  `device_id` varchar(50) NOT NULL,
  `device_name` varchar(150) NOT NULL,
  `hour_start` datetime NOT NULL,
  `energy_kwh` decimal(10,3) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_hour` (`device_type`,`device_id`,`hour_start`)
) ENGINE=InnoDB AUTO_INCREMENT=39289 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: energy_weekly_analytics

```sql
CREATE TABLE `energy_weekly_analytics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `device_type` varchar(36) NOT NULL,
  `device_id` varchar(50) NOT NULL,
  `device_name` varchar(150) NOT NULL,
  `week_start` date NOT NULL,
  `week_label` varchar(10) NOT NULL,
  `energy_kwh` decimal(10,3) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_week` (`device_type`,`device_id`,`week_start`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: event

```sql
CREATE TABLE `event` (
  `id` varchar(36) NOT NULL,
  `device_id` varchar(36) NOT NULL,
  `device_type` varchar(45) NOT NULL,
  `data` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_event_device_idx` (`device_id`),
  KEY `event_device_type` (`device_type`),
  KEY `event_created_at_idx` (`created_at`),
  KEY `by_device_id` (`device_id`),
  KEY `by_device_type` (`device_type`),
  KEY `device_type_index` (`device_type`),
  KEY `idx_device_type` (`device_type`),
  CONSTRAINT `fk_event_device` FOREIGN KEY (`device_id`) REFERENCES `device` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: floor

```sql
CREATE TABLE `floor` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `building_id` varchar(36) NOT NULL,
  `type` varchar(9) DEFAULT NULL,
  `floor_number` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_floor_building_idx` (`building_id`),
  KEY `floor_type_idx` (`type`),
  CONSTRAINT `fk_floor_building` FOREIGN KEY (`building_id`) REFERENCES `building` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gateway

```sql
CREATE TABLE `gateway` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `ip` varchar(16) NOT NULL,
  `status` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ip_UNIQUE` (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gateway_mapping

```sql
CREATE TABLE `gateway_mapping` (
  `zone_id` varchar(36) NOT NULL,
  `gateway_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `fk_gateway_mapping_zone_idx` (`zone_id`),
  KEY `fk_gateway_mapping_gateway_idx` (`gateway_id`),
  CONSTRAINT `fk_gateway_mapping_gateway` FOREIGN KEY (`gateway_id`) REFERENCES `gateway` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gateway_mapping_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: generated_reports

```sql
CREATE TABLE `generated_reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `file_path` varchar(255) DEFAULT NULL,
  `from_time` datetime DEFAULT NULL,
  `to_time` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_access

```sql
CREATE TABLE `gl_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `access_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_alarm

```sql
CREATE TABLE `gl_alarm` (
  `id` int NOT NULL AUTO_INCREMENT,
  `validate` tinyint(1) DEFAULT '0',
  `ss_id` varchar(36) DEFAULT NULL,
  `alarm_code` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `message` text,
  `acknowledged` tinyint(1) DEFAULT '0',
  `acknowledged_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `restore` tinyint(1) DEFAULT '0',
  `restored_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `delete_alarm` tinyint(1) DEFAULT '0',
  `deleted_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) DEFAULT NULL,
  `possible_causes` text,
  `name` varchar(36) DEFAULT NULL,
  `tag` varchar(36) DEFAULT NULL,
  `description` varchar(36) DEFAULT NULL,
  `source` varchar(36) DEFAULT NULL,
  `technician_feedback` text,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  CONSTRAINT `gl_alarm_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=87 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_all_type

```sql
CREATE TABLE `gl_all_type` (
  `id` int NOT NULL AUTO_INCREMENT,
  `type` varchar(256) DEFAULT NULL,
  `name` varchar(256) DEFAULT NULL,
  `tag` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `referring_table` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `type` (`type`)
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_control_command

```sql
CREATE TABLE `gl_control_command` (
  `id` varchar(36) NOT NULL,
  `targert_id` varchar(36) DEFAULT NULL,
  `target_type` varchar(36) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `ss_type` varchar(36) DEFAULT NULL,
  `zone_type` varchar(36) DEFAULT NULL,
  `zone_id` varchar(36) DEFAULT NULL,
  `gl_command` varchar(36) NOT NULL,
  `param_id` varchar(36) NOT NULL,
  `param_value` varchar(36) NOT NULL,
  `priority` int DEFAULT '8',
  `triggered_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_ibms_event

```sql
CREATE TABLE `gl_ibms_event` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` varchar(36) NOT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `event_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `description` varchar(36) DEFAULT NULL,
  `triggering_user` varchar(36) DEFAULT NULL,
  `alarm_id` varchar(36) DEFAULT 'NO_ALARM',
  `criticality` varchar(36) DEFAULT 'GL_EVENT_CRITICALITY_LOW',
  `open_close` varchar(36) DEFAULT 'GL_EVENT_STATUS_OPEN',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location

```sql
CREATE TABLE `gl_location` (
  `id` varchar(36) NOT NULL DEFAULT 'qw',
  `name` varchar(256) DEFAULT NULL,
  `zone_tag` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `zone_shape` enum('rect','circle','poly','GL_LOCATION_SHAPE_DEFAULT') DEFAULT 'rect',
  `zone_type` varchar(256) DEFAULT NULL,
  `zone_status` enum('GL_LOCATION_STATUS_ACTIVE','GL_LOCATION_STATUS_INACTIVE') DEFAULT 'GL_LOCATION_STATUS_ACTIVE',
  `zone_parent` varchar(36) DEFAULT NULL,
  `coordinates` varchar(1024) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zone_type` (`zone_type`),
  CONSTRAINT `gl_location_ibfk_1` FOREIGN KEY (`zone_type`) REFERENCES `gl_all_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location_input_map

```sql
CREATE TABLE `gl_location_input_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone_id` varchar(36) DEFAULT NULL,
  `triggered_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zone_id` (`zone_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_location_input_map_ibfk_1` FOREIGN KEY (`zone_id`) REFERENCES `gl_location` (`id`),
  CONSTRAINT `gl_location_input_map_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location_output_map

```sql
CREATE TABLE `gl_location_output_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zone_id` (`zone_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_location_output_map_ibfk_1` FOREIGN KEY (`zone_id`) REFERENCES `gl_location` (`id`),
  CONSTRAINT `gl_location_output_map_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location_scheduled_service_map

```sql
CREATE TABLE `gl_location_scheduled_service_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `zone_id` varchar(36) DEFAULT NULL,
  `schedule_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_GL_LOCATION_scheduled_service_map` (`zone_id`),
  KEY `fk_GL_LOCATION_scheduled_service_map1` (`schedule_id`),
  CONSTRAINT `fk_GL_LOCATION_scheduled_service_map` FOREIGN KEY (`zone_id`) REFERENCES `gl_location` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_GL_LOCATION_scheduled_service_map1` FOREIGN KEY (`schedule_id`) REFERENCES `gl_schedule` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location_subsystem_map

```sql
CREATE TABLE `gl_location_subsystem_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `zone_id` varchar(36) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zone_id` (`zone_id`),
  KEY `ss_id` (`ss_id`),
  CONSTRAINT `gl_location_subsystem_map_ibfk_1` FOREIGN KEY (`zone_id`) REFERENCES `gl_location` (`id`),
  CONSTRAINT `gl_location_subsystem_map_ibfk_2` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_location_user

```sql
CREATE TABLE `gl_location_user` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `zone_id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `usage_start_time` timestamp NOT NULL,
  `usage_end_time` timestamp NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_metric

```sql
CREATE TABLE `gl_metric` (
  `id` varchar(256) NOT NULL,
  `name` varchar(256) DEFAULT NULL,
  `tag` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `unit` varchar(256) DEFAULT NULL,
  `unit_display` varchar(64) DEFAULT NULL,
  `ss_type` varchar(256) DEFAULT NULL,
  `time_window` varchar(36) DEFAULT NULL,
  `computing_methodology` varchar(256) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_parameter

```sql
CREATE TABLE `gl_parameter` (
  `id` varchar(256) NOT NULL,
  `name` varchar(256) DEFAULT NULL,
  `tag` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `unit` varchar(256) DEFAULT NULL,
  `unit_display` varchar(64) DEFAULT NULL,
  UNIQUE KEY `id` (`id`),
  KEY `unit` (`unit`),
  CONSTRAINT `gl_parameter_ibfk_1` FOREIGN KEY (`unit`) REFERENCES `gl_all_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_pas_res

```sql
CREATE TABLE `gl_pas_res` (
  `id` int NOT NULL AUTO_INCREMENT,
  `trigger_id` varchar(36) NOT NULL,
  `Alarm_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_role

```sql
CREATE TABLE `gl_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `name` varchar(255) NOT NULL,
  `discription` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_role_access

```sql
CREATE TABLE `gl_role_access` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role_id` int NOT NULL,
  `access_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_gl_role_access` (`role_id`),
  KEY `fk_gl_role_access2` (`access_id`),
  CONSTRAINT `fk_gl_role_access` FOREIGN KEY (`role_id`) REFERENCES `gl_role` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gl_role_access2` FOREIGN KEY (`access_id`) REFERENCES `gl_access` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_schedule

```sql
CREATE TABLE `gl_schedule` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `description` varchar(100) DEFAULT NULL,
  `cron_tab_fields` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  `referenceId` varchar(36) DEFAULT NULL,
  `type` enum('start','end') DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_schedule_detail

```sql
CREATE TABLE `gl_schedule_detail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schedule_id` varchar(256) DEFAULT NULL,
  `target_id` varchar(256) DEFAULT NULL,
  `target_type` varchar(256) DEFAULT NULL,
  `zone_id` varchar(1024) DEFAULT NULL,
  `zone_type` varchar(36) DEFAULT NULL,
  `ss_id` varchar(1024) DEFAULT NULL,
  `ss_type` varchar(36) DEFAULT NULL,
  `command` varchar(256) DEFAULT NULL,
  `arguments` varchar(256) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `param_name` varchar(255) DEFAULT NULL,
  `param_value` varchar(255) DEFAULT NULL,
  `priority` int DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `gl_schedule_detail_ibfk_1` (`schedule_id`),
  KEY `gl_schedule_detail_ibfk_2` (`target_type`),
  CONSTRAINT `gl_schedule_detail_ibfk_1` FOREIGN KEY (`schedule_id`) REFERENCES `gl_schedule` (`id`),
  CONSTRAINT `gl_schedule_detail_ibfk_2` FOREIGN KEY (`target_type`) REFERENCES `gl_all_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_schedule_map

```sql
CREATE TABLE `gl_schedule_map` (
  `id` varchar(36) NOT NULL,
  `zone_id` varchar(36) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `time_id` varchar(36) DEFAULT NULL,
  `schedule_status` enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') DEFAULT 'GL_SS_STATUS_ACTIVE',
  `recurring_status` enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') DEFAULT 'GL_SS_STATUS_ACTIVE',
  `arguments` json NOT NULL,
  `schedule_type` varchar(256) DEFAULT NULL,
  `expected_status` varchar(255) DEFAULT 'pending',
  `name` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `zone_id` (`zone_id`),
  KEY `device_id` (`ss_id`),
  KEY `time_id` (`time_id`),
  CONSTRAINT `gl_schedule_map_ibfk_1` FOREIGN KEY (`zone_id`) REFERENCES `gl_location` (`id`),
  CONSTRAINT `gl_schedule_map_ibfk_2` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `gl_schedule_map_ibfk_3` FOREIGN KEY (`time_id`) REFERENCES `gl_timestamp` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem

```sql
CREATE TABLE `gl_subsystem` (
  `id` varchar(36) NOT NULL DEFAULT 'qw',
  `name` varchar(256) DEFAULT NULL,
  `ss_tag` varchar(256) DEFAULT NULL,
  `description` varchar(1024) DEFAULT NULL,
  `ss_type` varchar(256) DEFAULT NULL,
  `ss_shape` enum('rect','circle','poly','GL_ZONE_SHAPE_DEFAULT') DEFAULT 'rect',
  `ss_status` enum('GL_SS_STATUS_ACTIVE','GL_SS_STATUS_INACTIVE') DEFAULT 'GL_SS_STATUS_ACTIVE',
  `ss_address_type` varchar(256) DEFAULT NULL,
  `ss_address_value` varchar(1024) DEFAULT NULL,
  `ss_parent` varchar(36) DEFAULT NULL,
  `coordinates` varchar(1024) DEFAULT '[0,0]',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_type` (`ss_type`),
  KEY `ss_address_type` (`ss_address_type`),
  CONSTRAINT `gl_subsystem_ibfk_1` FOREIGN KEY (`ss_type`) REFERENCES `gl_all_type` (`type`),
  CONSTRAINT `gl_subsystem_ibfk_2` FOREIGN KEY (`ss_address_type`) REFERENCES `gl_all_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem_detail

```sql
CREATE TABLE `gl_subsystem_detail` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `param_name` varchar(255) DEFAULT NULL,
  `param_value` varchar(255) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_gl_subsystem_detail` (`ss_id`),
  CONSTRAINT `fk_gl_subsystem_detail` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem_input_map

```sql
CREATE TABLE `gl_subsystem_input_map` (
  `id` varchar(36) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `triggered_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) DEFAULT NULL,
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_subsystem_input_map_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `gl_subsystem_input_map_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem_latest_event

```sql
CREATE TABLE `gl_subsystem_latest_event` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_subsystem_latest_event_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `gl_subsystem_latest_event_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=512 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem_output_map

```sql
CREATE TABLE `gl_subsystem_output_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_subsystem_output_map_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `gl_subsystem_output_map_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_subsystem_process_map

```sql
CREATE TABLE `gl_subsystem_process_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `process_id` varchar(36) DEFAULT NULL,
  `ss_id` varchar(36) DEFAULT NULL,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `gl_subsystem_process_map_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `gl_subsystem_process_map_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_timestamp

```sql
CREATE TABLE `gl_timestamp` (
  `id` varchar(36) NOT NULL,
  `start` tinytext,
  `end` tinytext,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_user

```sql
CREATE TABLE `gl_user` (
  `id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `name` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `user_type` varchar(36) DEFAULT NULL,
  `email_id` varchar(255) DEFAULT NULL,
  `phone_no` varchar(10) DEFAULT NULL,
  `login_id` varchar(36) NOT NULL,
  `password` varchar(180) NOT NULL,
  `registered_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `login_id` (`login_id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `email_id` (`email_id`),
  UNIQUE KEY `phone_no` (`phone_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_user_role

```sql
CREATE TABLE `gl_user_role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) NOT NULL,
  `role_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_gl_user_role` (`user_id`),
  KEY `fk_gl_user_role2` (`role_id`),
  CONSTRAINT `fk_gl_user_role` FOREIGN KEY (`user_id`) REFERENCES `gl_user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_gl_user_role2` FOREIGN KEY (`role_id`) REFERENCES `gl_role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: gl_user_session

```sql
CREATE TABLE `gl_user_session` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) NOT NULL,
  `token` text NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: hvac_recurring_schedule

```sql
CREATE TABLE `hvac_recurring_schedule` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `data` json NOT NULL,
  `status` tinyint(1) DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `floor_id` varchar(36) NOT NULL,
  `floor_name` varchar(36) NOT NULL,
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`),
  KEY `fk_schedule_device_idx` (`floor_id`),
  CONSTRAINT `fk_hvac_recurring_schedule_floor` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: hvac_schedule

```sql
CREATE TABLE `hvac_schedule` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `data` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `floor_id` varchar(36) NOT NULL,
  `floor_name` varchar(36) NOT NULL,
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`),
  KEY `fk_schedule_device_idx` (`floor_id`),
  CONSTRAINT `fk_hvac_schedule_floor` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: latest_command

```sql
CREATE TABLE `latest_command` (
  `id` varchar(36) NOT NULL,
  `mode` varchar(120) NOT NULL,
  `intensity` int NOT NULL,
  `mac_id` varchar(120) NOT NULL,
  `data` text NOT NULL,
  `gatewayip` varchar(16) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `event_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: latest_event

```sql
CREATE TABLE `latest_event` (
  `id` varchar(36) NOT NULL,
  `device_id` varchar(36) NOT NULL,
  `device_name` varchar(120) NOT NULL,
  `device_type` varchar(45) NOT NULL,
  `data` text NOT NULL,
  `network_data` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `area_id` varchar(36) NOT NULL,
  `zone_id` varchar(36) NOT NULL,
  `floor_id` varchar(36) NOT NULL,
  `building_id` varchar(36) NOT NULL,
  `campus_id` varchar(36) NOT NULL,
  `campus_name` varchar(120) DEFAULT NULL,
  `building_name` varchar(120) DEFAULT NULL,
  `floor_name` varchar(120) DEFAULT NULL,
  `zone_name` varchar(120) DEFAULT NULL,
  `area_name` varchar(120) DEFAULT NULL,
  `floor_number` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_id_UNIQUE` (`device_id`),
  KEY `fk_event_device_idx` (`device_id`),
  KEY `event_device_type` (`device_type`),
  KEY `event_device_name` (`device_name`),
  KEY `event_created_at_idx` (`created_at`),
  KEY `fk_latest_event_zone_idx` (`zone_id`),
  KEY `fk_latest_event_area_idx` (`area_id`),
  KEY `fk_latest_event_floor_idx` (`floor_id`),
  KEY `fk_latest_event_building_idx` (`building_id`),
  KEY `fk_latest_event_campus_idx` (`campus_id`),
  KEY `idx_device_type` (`device_type`),
  CONSTRAINT `fk_latest_event_area` FOREIGN KEY (`area_id`) REFERENCES `area` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_latest_event_building` FOREIGN KEY (`building_id`) REFERENCES `building` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_latest_event_campus` FOREIGN KEY (`campus_id`) REFERENCES `campus` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_latest_event_device` FOREIGN KEY (`device_id`) REFERENCES `device` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_latest_event_floor` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_latest_event_zone` FOREIGN KEY (`zone_id`) REFERENCES `zone` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: mwp0001150000_metric

```sql
CREATE TABLE `mwp0001150000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: mwp0001150000_om_p

```sql
CREATE TABLE `mwp0001150000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=69655 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: mwp0002150000_metric

```sql
CREATE TABLE `mwp0002150000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: mwp0002150000_om_p

```sql
CREATE TABLE `mwp0002150000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23219 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: one_month_data

```sql
CREATE TABLE `one_month_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: organization

```sql
CREATE TABLE `organization` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: parking_status

```sql
CREATE TABLE `parking_status` (
  `id` varchar(36) NOT NULL,
  `context_id` varchar(36) NOT NULL,
  `total` int NOT NULL,
  `availability` int DEFAULT NULL,
  `occupied` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: plant_normalized

```sql
CREATE TABLE `plant_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `slot_time` datetime NOT NULL COMMENT 'End time of the 5/15 min window',
  `total_kw` decimal(10,4) DEFAULT '0.0000' COMMENT 'Sum of all device KWs',
  `total_kwh` decimal(10,4) DEFAULT '0.0000' COMMENT 'total_kw * interval / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT '0.0000' COMMENT 'Running total KWH',
  `total_tr` decimal(10,4) DEFAULT '0.0000' COMMENT 'TR ? direct from meter or sum of chillers',
  `total_trh` decimal(10,4) DEFAULT '0.0000' COMMENT 'total_tr * interval / 60',
  `cumulative_trh` decimal(20,4) DEFAULT '0.0000' COMMENT 'Cumulative TRH ? direct from meter or running total',
  `aux_kw` decimal(10,4) DEFAULT '0.0000' COMMENT 'Sum of non-chiller device KWs',
  `aux_kwh` decimal(10,4) DEFAULT '0.0000' COMMENT 'aux_kw * interval / 60',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1713 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Plant-level aggregated normalized data'
```

## Table: primary_pump_1_normalized

```sql
CREATE TABLE `primary_pump_1_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of PriV_Pmp_Drive_Power',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of PriV_Pmp_Drive_Run_Hrs',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes  / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1708 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized primary_pump data for primary_pump_1'
```

## Table: primary_pump_2_normalized

```sql
CREATE TABLE `primary_pump_2_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of PriV_Pmp_Drive_Power',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of PriV_Pmp_Drive_Run_Hrs',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes  / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1708 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized primary_pump data for primary_pump_2'
```

## Table: primary_pump_3_normalized

```sql
CREATE TABLE `primary_pump_3_normalized` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) NOT NULL COMMENT 'Device UUID',
  `slot_time` datetime NOT NULL COMMENT 'End time of the window',
  `is_running` tinyint(1) NOT NULL DEFAULT '0' COMMENT '1=running, 0=off',
  `kw` decimal(10,4) DEFAULT NULL COMMENT 'Weighted avg of PriV_Pmp_Drive_Power',
  `run_hours` decimal(10,4) DEFAULT NULL COMMENT 'Latest value of PriV_Pmp_Drive_Run_Hrs',
  `kwh` decimal(10,4) DEFAULT NULL COMMENT 'Calculated: kw * on_minutes  / 60',
  `cumulative_kwh` decimal(20,4) DEFAULT NULL COMMENT 'Calculated: prev_cumulative_kwh + kwh',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slot_time` (`slot_time`)
) ENGINE=InnoDB AUTO_INCREMENT=1708 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Normalized primary_pump data for primary_pump_3'
```

## Table: priseq_0001cb0000_metric

```sql
CREATE TABLE `priseq_0001cb0000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3612 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: priseq_0001cb0000_om_p

```sql
CREATE TABLE `priseq_0001cb0000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=320856 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0001b20000_metric

```sql
CREATE TABLE `pv_0001b20000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=160727 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0001b20000_om_p

```sql
CREATE TABLE `pv_0001b20000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=521917 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0002b20000_metric

```sql
CREATE TABLE `pv_0002b20000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=95245 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0002b20000_om_p

```sql
CREATE TABLE `pv_0002b20000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=522362 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0003b20000_metric

```sql
CREATE TABLE `pv_0003b20000_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=95225 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: pv_0003b20000_om_p

```sql
CREATE TABLE `pv_0003b20000_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`)
) ENGINE=InnoDB AUTO_INCREMENT=514031 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: reference_metric

```sql
CREATE TABLE `reference_metric` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: reference_om_p

```sql
CREATE TABLE `reference_om_p` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_index` (`ss_id`,`param_id`,`measured_time`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `reference_om_p_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `reference_om_p_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: report_subscriptions

```sql
CREATE TABLE `report_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) NOT NULL,
  `report_type` varchar(50) DEFAULT 'CHILLER_REPORT',
  `email_ids` text NOT NULL,
  `frequency` enum('DAILY','WEEKLY','MONTHLY','YEARLY') NOT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_report_subscription_user` (`user_id`),
  CONSTRAINT `fk_report_subscription_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: schedule

```sql
CREATE TABLE `schedule` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `data` json NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `floor_id` varchar(36) NOT NULL,
  `floor_name` varchar(36) NOT NULL,
  `start` datetime NOT NULL,
  `end` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name_UNIQUE` (`name`),
  KEY `fk_schedule_device_idx` (`floor_id`),
  CONSTRAINT `fk_schedule_floor` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: server_instrumentation

```sql
CREATE TABLE `server_instrumentation` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `metric_id` varchar(36) DEFAULT NULL,
  `metric_value` varchar(36) DEFAULT NULL,
  `metric_minimum` varchar(36) DEFAULT NULL,
  `metric_average` varchar(36) DEFAULT NULL,
  `metric_maximum` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  KEY `metric_id` (`metric_id`),
  CONSTRAINT `server_instrumentation_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `server_instrumentation_ibfk_2` FOREIGN KEY (`metric_id`) REFERENCES `gl_metric` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: session

```sql
CREATE TABLE `session` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: super_admin

```sql
CREATE TABLE `super_admin` (
  `id` varchar(36) NOT NULL,
  `username` varchar(45) NOT NULL,
  `password` varchar(180) NOT NULL,
  `role_name` varchar(24) NOT NULL,
  `role_id` int NOT NULL,
  `total_devices` int NOT NULL,
  `mac_address` varchar(180) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: testingtable

```sql
CREATE TABLE `testingtable` (
  `measured_time` timestamp NULL DEFAULT NULL,
  `zone_temperature` varchar(36) DEFAULT NULL,
  `occupancy` varchar(36) DEFAULT NULL,
  UNIQUE KEY `measured_time` (`measured_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: user

```sql
CREATE TABLE `user` (
  `id` varchar(36) NOT NULL,
  `campus_id` varchar(36) DEFAULT NULL,
  `username` varchar(45) NOT NULL,
  `password` varchar(180) NOT NULL,
  `secret` varchar(18) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` varchar(50) DEFAULT NULL,
  `email` varchar(180) DEFAULT NULL,
  `role_id` int NOT NULL,
  `role_name` varchar(24) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT '1',
  `building_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username_UNIQUE` (`username`),
  UNIQUE KEY `user_email_UNIQUE` (`email`),
  KEY `fk_user_campus_idx` (`campus_id`),
  CONSTRAINT `fk_user_campus` FOREIGN KEY (`campus_id`) REFERENCES `campus` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: weather_service

```sql
CREATE TABLE `weather_service` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ss_id` varchar(36) DEFAULT NULL,
  `measured_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `param_id` varchar(36) DEFAULT NULL,
  `param_value` varchar(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ss_id` (`ss_id`),
  KEY `param_id` (`param_id`),
  CONSTRAINT `weather_service_ibfk_1` FOREIGN KEY (`ss_id`) REFERENCES `gl_subsystem` (`id`),
  CONSTRAINT `weather_service_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `gl_parameter` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## Table: zone

```sql
CREATE TABLE `zone` (
  `id` varchar(36) NOT NULL,
  `name` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `floor_id` varchar(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_zone_floor_idx` (`floor_id`),
  CONSTRAINT `fk_zone_floor` FOREIGN KEY (`floor_id`) REFERENCES `floor` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

