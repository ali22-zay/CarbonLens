# CarbonLens: Entity-Relationship Diagram (ERD)
**Course:** CS-2104 Database Systems  
**Project:** CarbonLens: Smart Campus Carbon Footprint & Sustainability Tracker  

The database architecture is designed in **Third Normal Form (3NF)** consisting of **9 core relational tables**, enforced with primary keys, foreign keys with referential integrity rules (`ON DELETE CASCADE`, `ON DELETE SET NULL`, `ON DELETE RESTRICT`), unique constraints, and check constraints.

---

## Mermaid ERD Diagram

```mermaid
erDiagram
    departments ||--o{ buildings : "supervises / owns"
    departments ||--o{ users : "employs / enrolls"
    buildings ||--o{ monthly_usage : "records"
    monthly_usage ||--o{ alerts : "triggers on limit exceed"
    users ||--o{ student_activities : "submits"
    users ||--o{ student_activities : "reviews / moderates"
    eco_activity_types ||--o{ student_activities : "categorizes"
    emission_factors {
        int factor_id PK
        enum resource_type UK "electricity | water | waste"
        varchar unit
        decimal kg_co2_per_unit
        timestamp updated_at
    }
    usage_limits {
        int limit_id PK
        enum resource_type UK "electricity | water | waste"
        decimal max_monthly_value
        timestamp updated_at
    }

    departments {
        int department_id PK
        varchar department_name UK
        varchar department_code UK
        timestamp created_at
    }

    buildings {
        int building_id PK
        varchar building_name
        int department_id FK
        timestamp created_at
    }

    users {
        int user_id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        enum role "admin | chairperson | student"
        int department_id FK "NULL for admin"
        timestamp created_at
    }

    monthly_usage {
        int usage_id PK
        int building_id FK
        tinyint month "1 to 12"
        smallint year ">= 2000"
        decimal electricity_kwh
        decimal water_liters
        decimal waste_kg
        decimal total_co2_kg "Auto-calculated by Trigger"
        timestamp created_at
    }

    alerts {
        int alert_id PK
        int usage_id FK
        enum resource_type "electricity | water | waste"
        varchar message
        boolean is_read
        timestamp created_at
    }

    eco_activity_types {
        int activity_type_id PK
        varchar activity_name UK
        int points "> 0"
        timestamp created_at
    }

    student_activities {
        int log_id PK
        int student_id FK
        int activity_type_id FK
        date activity_date
        text description
        enum status "pending | approved | rejected"
        int reviewed_by FK "reviewer user_id"
        timestamp reviewed_at
        timestamp created_at
    }
```

---

## Entity Relationship Cardinalities

| Relationship | Cardinality | Business Logic & Referential Integrity |
|---|---|---|
| **departments → buildings** | `1 : M` | One department manages one or many physical campus buildings. If a department is deleted, `ON DELETE CASCADE` removes child buildings. |
| **departments → users** | `1 : M` | One department has many students and one chairperson. Administrators are independent (`department_id = NULL`). If a department is deleted, `ON DELETE SET NULL` preserves user accounts. |
| **buildings → monthly_usage** | `1 : M` | Each building has at most one usage record per month/year (enforced by `UNIQUE(building_id, month, year)`). Deleting a building cascades to delete historical usage. |
| **monthly_usage → alerts** | `1 : M` | A single monthly usage entry can generate up to 3 alerts (electricity, water, waste) via `trg_usage_alert_insert`. Cascade deleted if usage is removed. |
| **users (students) → student_activities** | `1 : M` | A student logs multiple eco-actions. `ON DELETE CASCADE` clears logs if a student account is removed. |
| **users (reviewers) → student_activities** | `1 : M` | A chairperson or admin reviews activities. `ON DELETE SET NULL` preserves student activity logs even if a staff account is deleted. |
| **eco_activity_types → student_activities** | `1 : M` | Lookup table defining standard point rewards. `ON DELETE RESTRICT` protects against deleting activity types currently referenced in student logs. |
| **emission_factors & usage_limits** | *Configuration* | Standalone lookup tables storing multipliers and thresholds utilized by MySQL database triggers. |
