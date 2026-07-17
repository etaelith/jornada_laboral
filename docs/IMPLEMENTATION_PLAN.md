# Riesgos y plan incremental — Fase 1

## Decisiones técnicas

1. Expo SDK 55 / RN 0.83 por API 36 e iOS 15.1; no se adopta SDK 57 sin necesidad.
2. Development builds y producción nativa; Expo Go solo podrá servir para prototipos visuales no aceptables.
3. Expo Router para navegación; Drizzle sobre `expo-sqlite` detrás de repositorios.
4. SQLite como única fuente de verdad; Zustand solo UI/desbloqueo.
5. SQLCipher más AES-GCM por campo de alto riesgo, condicionado a ARMv7.
6. Instantes UTC y zona IANA capturada; cálculos puros por zona del perfil.
7. Auditoría append-only y borrado lógico; toda edición manual es transaccional y revisable.
8. Sync futuro mediante un puerto sin dependencia del repositorio local.
9. Importaciones se validan completas antes de una única transacción confirmada.
10. Exportaciones y backup se transmiten por lotes; no se cargan archivos extensos enteros.

## Riesgos principales

| Riesgo | Probabilidad / impacto | Mitigación y disparador |
| --- | --- | --- |
| Una dependencia elimina ARMv7 | Alta / crítica | Spike, inspección ELF y APK por ABI; reemplazar antes de dominio |
| SQLCipher aumenta tamaño/RSS o falla ARMv7 | Media / alta | Medir; fallback a cifrado de todos los campos sensibles |
| Expo 55 pierde ventana de mantenimiento antes de publicar | Media / alta | Revalidar tiendas al inicio de cada fase; ADR de upgrade con repetición del spike |
| Pérdida/invalidez de SecureStore | Media / crítica | No sobrescribir; modo recuperación y backup manual cifrado |
| Reloj/zona/DST producen duraciones falsas | Media / alta | UTC+IANA, Clock inyectable, flags y suite de casos límite |
| Doble pulsación/concurrencia | Media / alta | índice único parcial, transacción inmediata e idempotency key |
| Importación/exportación bloquea ARMv7 | Media / alta | streaming/lotes, límites, progreso y benchmarks de 10 años |
| Datos visibles en logs/notificaciones | Media / alta | allowlist de logs, revisión estática y contenido genérico por defecto |
| Auditoría crece sin límite | Media / media | paginación, retención solo de logs técnicos; revisiones laborales no se borran silenciosamente |
| Compatibilidad de iPhone 6s no disponible para prueba | Media / media | granja/dispositivo externo o documentar desviación antes de release |

## Plan por fases y tareas verificables

### Puerta 0 — spike de compatibilidad

- Crear proyecto mínimo y lockfile.
- Compilar AAB, APK ARMv7, APK ARM64 e iOS.
- Verificar SQLite/SQLCipher, AES-GCM y SecureStore tras reinicio.
- Registrar ABI, tamaño, RSS y arranque.

Salida: matriz confirmada en hardware o decisión de reemplazo. No se implementan pantallas de producto en este spike.

### Fase 2 — base técnica

- Configurar Expo Router, TypeScript strict, lint, formato y CI.
- Implementar esquema v1, migrador con checksums, PRAGMA WAL/foreign keys y repositorios.
- Implementar KeyManager/EncryptionProvider y estado seguro de recuperación.
- Añadir contratos de dominio, Clock y SyncProvider deshabilitado.
- Pruebas: migración limpia/repetida, repositorios, constraints, cifrado, manipulación y clave ausente.

Salida: typecheck, lint y tests verdes; builds nativos en ambas ABI e iOS.

### Fase 3 — fichaje

- Crear perfil inicial e Inicio accesible.
- Casos de uso de entrada/salida y pausa con idempotencia.
- Contador aislado y recuperación después de cierre/reinicio.
- Resumen de hoy y anomalías de sesión abierta/pausa abierta.
- Pruebas unitarias, integración y E2E de flujos principales.

Salida: crear, pausar, reanudar y cerrar en hardware ARMv7/ARM64/iOS sin duplicados.

### Fase 4 — gestión

- Calendario mensual paginado, detalle e historial.
- Creación/edición manual, revisión obligatoria, deshacer y borrado lógico.
- Clasificación diaria y detección de solapamientos.
- Pruebas de auditoría, concurrencia, medianoche, DST y accesibilidad.

Salida: todo cambio manual reconstruible desde revisiones.

### Fase 5 — estadísticas

- Cálculos puros diario/semanal/mensual, objetivos, extras/faltantes y período anterior.
- Consultas por rango, benchmarks con diez años y validación de índices.
- UI diferida y accesible sin gráficos pesados.

Salida: resultados validados con fixtures de zonas, DST y períodos incompletos.

### Fase 6 — importación/exportación

- Plantillas CSV/XLSX, validación completa, errores por fila, vista previa y duplicados.
- Importación confirmada en transacción y revisiones al reemplazar.
- CSV UTF-8, XLSX con cuatro hojas, PDF, totales y compartir nativo.
- Procesamiento por lotes, cancelación/progreso y pruebas de archivos extensos.

Salida: round-trip verificable y UI sin bloqueos perceptibles en ARMv7.

### Fase 7 — seguridad y estabilización

- Biometría/PIN, notificaciones locales y privacidad en segundo plano.
- Backup/restauración cifrada, rotación de claves y conflictos.
- Auditoría de seguridad, accesibilidad y todos los casos límite.
- AAB de producción, APKs por ABI e iOS/TestFlight; checklist de tiendas.

Salida: builds firmados, pruebas reales, cero errores conocidos críticos/altos y documentación operativa.

## Estrategia de pruebas

- Unitarias: dominio, zonas, DST, redondeo, anomalías, import/export serializers.
- Repositorios: SQLite real temporal, constraints, planes de consulta y migraciones.
- Componentes: estados, lector de pantalla, pulsación repetida, errores accionables.
- Integración: caso de uso → cifrado → repositorio → reinicio.
- E2E: entrada/salida, pausa, edición/revisión, importación y restauración en development build.
- Seguridad: ciphertext manipulado, nonce único, AAD incorrecto, clave ausente/rotada y backup corrupto.

## Disciplina por incremento

Cada tarea modifica un conjunto pequeño, añade pruebas y actualiza documentos. Antes de continuar se ejecutan typecheck, lint, unitarias/integración y el build proporcional al cambio. Los errores conocidos se corrigen o bloquean formalmente la fase; no se simplifican requisitos en silencio.

## Criterio actual

Fase 1 está documentada. La siguiente acción autorizable es la Puerta 0/Fase 2; no debe comenzar hasta que el usuario acepte esta definición y permita crear el proyecto y descargar dependencias.
