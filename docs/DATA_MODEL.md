# Modelo de datos — Fase 1

## Convenciones

- UUID v4 generados criptográficamente.
- Instantes UTC como enteros epoch en milisegundos; zonas como identificadores IANA.
- Fechas civiles `YYYY-MM-DD`.
- Booleanos SQLite `0/1` con restricciones `CHECK`.
- Borrado lógico mediante `deleted_at_utc`.
- Columnas cifradas almacenan un sobre binario versionado `{version, keyId, nonce, ciphertext, tag}`.
- Toda tabla mutable incluye `created_at_utc`, `updated_at_utc` y `row_version` para auditoría/sincronización futura.

## Tablas de dominio

### `work_profiles`

`id`, `name_encrypted`, `company_name_encrypted`, `expected_minutes_per_day`, `expected_minutes_per_week`, `work_days_mask`, `week_starts_on`, `timezone`, `rounding_rule_json`, `created_at_utc`, `updated_at_utc`, `row_version`, `deleted_at_utc`.

`work_days_mask` es una máscara de siete bits validada en dominio. La regla de redondeo es configuración no ejecutable, validada con Zod al cruzar la infraestructura.

### `work_sessions`

`id`, `profile_id`, `started_at_utc`, `ended_at_utc`, `start_timezone`, `end_timezone`, `source`, `status`, `note_encrypted`, `operation_id`, `review_flags`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`, `row_version`.

Restricciones: fin nulo o mayor/igual al inicio; claves foráneas; enums por `CHECK`. `review_flags` es una máscara derivada que evita corregir automáticamente datos dudosos.

### `break_sessions`

`id`, `work_session_id`, `started_at_utc`, `ended_at_utc`, `is_paid`, `note_encrypted`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`, `row_version`.

La contención y el no solapamiento se validan en el caso de uso dentro de la misma transacción; se vuelven a comprobar al importar/restaurar.

### `work_session_revisions`

`id`, `work_session_id`, `previous_data_encrypted`, `new_data_encrypted`, `reason_encrypted`, `changed_at_utc`, `device_id`, `change_type`, `schema_version`.

Es append-only. Cada edición manual crea la revisión antes de actualizar el registro. El borrado lógico también genera revisión.

### `day_classifications`

`id`, `profile_id`, `local_date`, `type`, `note_encrypted`, `created_at_utc`, `updated_at_utc`, `deleted_at_utc`, `row_version`.

Única por `(profile_id, local_date)` mientras no esté borrada.

### `app_settings`

Una fila con `id = 'app'`: `biometric_lock_enabled`, `theme`, `language`, `time_format`, `first_day_of_week`, `export_preferences_json`, `reminder_preferences_json`, `reduced_effects`, `updated_at_utc`.

No contiene PIN, claves ni secretos. Un PIN se convierte mediante KDF y solo su verificador protegido se almacena en SecureStore.

## Tablas técnicas

- `schema_migrations(version, name, checksum, applied_at_utc)`.
- `key_metadata(key_id, purpose, algorithm, version, status, created_at_utc, rotated_at_utc)`; nunca contiene material de clave.
- `devices(id, created_at_utc, label_encrypted, public_identity)` para auditoría y sincronización futura.
- `operation_log(operation_id, type, completed_at_utc)` para idempotencia local, con retención limitada.
- `sync_outbox(id, aggregate_type, aggregate_id, row_version, payload_encrypted, created_at_utc, state)`; se crea cuando se implemente sincronización, no en el MVP inicial.

## Índices iniciales candidatos

- `work_sessions(profile_id)`.
- `work_sessions(started_at_utc)`.
- `work_sessions(ended_at_utc)`.
- `work_sessions(status)`.
- `work_sessions(deleted_at_utc)`.
- `work_sessions(profile_id, started_at_utc)`.
- único parcial `work_sessions(profile_id) WHERE ended_at_utc IS NULL AND deleted_at_utc IS NULL AND status = 'OPEN'`.
- `break_sessions(work_session_id, started_at_utc)`.
- único `operation_log(operation_id)`.

Son candidatos, no dogma: en Fase 2 se validarán con `EXPLAIN QUERY PLAN` sobre un conjunto de diez años y se eliminarán los que no mejoren consultas reales.

## Reglas y cálculos

Las siguientes funciones serán puras: duración bruta, pausas no remuneradas, duración neta, división por día civil, totales por período/zona, objetivos, extras/faltantes, redondeo y solapamientos.

La duración neta es `max(0, fin - inicio) - suma(pausas no remuneradas cerradas)`. Una sesión abierta solo produce duración provisional para presentación. El dominio devuelve anomalías en vez de alterar datos.

Anomalías previstas: `MISSING_END`, `OPEN_BREAK`, `SESSION_OVERLAP`, `BREAK_OVERLAP`, `NEGATIVE_DURATION`, `UNUSUALLY_LONG`, `TIMEZONE_CHANGED`, `POSSIBLE_DUPLICATE`, `CLOCK_ROLLBACK` y `KEY_UNAVAILABLE`.

## Consultas y escalabilidad

Los repositorios exponen rangos y paginación por cursor `(started_at_utc, id)`, nunca `SELECT *` sin límite. Los resúmenes se calculan por lotes fuera del render. Solo se añadirán agregados persistidos después de medir una ganancia y definir su invalidación transaccional.
