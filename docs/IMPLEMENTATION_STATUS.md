# Estado de implementación

Fecha: 16 de julio de 2026.

## Entregado

- Expo SDK 55, React Native 0.83.6, TypeScript estricto, Router y development builds.
- Configuración Android API 24/36, ABIs ARMv7/ARM64, SQLCipher, R8 y reducción de recursos.
- SQLite con migración v1, WAL, claves foráneas, índices y repositorio tipado.
- Llavero aleatorio en SecureStore, clave separada para SQLCipher y AES-256-GCM por campo.
- Inicio con entrada/salida idempotente, contador aislado y pausas.
- Calendario mensual, detalle diario, creación/edición, revisiones y borrado lógico.
- Estadísticas de hoy, semana, mes, objetivos, extra/faltante y comparación anterior.
- CSV, XLSX, PDF, plantilla, vista previa CSV, errores por fila, duplicados y transacción.
- Bloqueo biométrico, recordatorio semanal y backup cifrado con restauración combinar/reemplazar.
- Temas nativos claro/oscuro, efectos reducidos, etiquetas accesibles y controles amplios.

## Validaciones realizadas

- TypeScript sin errores.
- ESLint sin errores ni advertencias.
- 13 pruebas unitarias aprobadas: duración, pausas, medianoche, DST, solapamientos, anomalías, objetivos e importación.
- Expo Doctor: 19/19 controles aprobados.
- `expo prebuild --platform android`: aprobado.
- Proyecto nativo generado con `reactNativeArchitectures=armeabi-v7a,arm64-v8a`, minSdk 24, compile/target 36 y SQLCipher habilitado.
- Bundle Android de producción generado con Metro: 1.686 módulos, Hermes bundle de aproximadamente 6 MB.

## Pendiente antes de producción

- Compilar AAB y APK ARMv7/ARM64: este equipo no tiene JDK ni Android SDK.
- Compilar iOS y TestFlight: requiere macOS/Xcode o credenciales EAS.
- Instalar y ejecutar en ARMv7 físico, ARM64 físico e iPhones de referencia.
- Medir inicio frío, RSS, batería, SQLite, PBKDF2 y exportación XLSX extensa.
- Añadir pruebas de repositorio sobre SQLite nativo, componentes y E2E en development builds.
- Probar biometría, notificaciones, compartir archivos, pérdida real de Keychain/Keystore y restauración en dispositivos.
- Completar recordatorios configurables de entrada/salida/duración; actualmente está implementado el recordatorio semanal.
- Realizar revisión externa de seguridad y accesibilidad antes de publicación.

La aplicación no debe etiquetarse todavía como “compatible con ARM de 32 bits” ni “lista para producción”; la configuración y el bundle están preparados, pero falta la aceptación en hardware y tiendas.
