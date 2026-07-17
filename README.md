# Jornada laboral

Aplicación móvil local-first para registrar jornadas laborales privadas en Android e iOS.

## Estado

Las fases funcionales 2–7 tienen una primera implementación integrada: base técnica, fichaje, gestión diaria, estadísticas, importación/exportación, biometría, recordatorios y copias cifradas. La validación en hardware ARMv7/iOS y los binarios firmados siguen pendientes porque el entorno local no dispone de JDK, Android SDK, macOS ni dispositivos físicos.

Documentos de la fase:

- [Arquitectura y navegación](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Seguridad y privacidad](docs/SECURITY.md)
- [Compatibilidad y rendimiento](docs/COMPATIBILITY.md)
- [Auditoría inicial de dependencias](DEPENDENCY_AUDIT.md)
- [Riesgos y plan incremental](docs/IMPLEMENTATION_PLAN.md)
- [Estado de implementación y validaciones](docs/IMPLEMENTATION_STATUS.md)

## Decisión de continuidad

La base propuesta es Expo SDK 55 / React Native 0.83, Android API 24–36, ABIs `armeabi-v7a` y `arm64-v8a`, e iOS 15.1+. Antes de comenzar la Fase 2 debe superarse el *spike* nativo descrito en [Compatibilidad y rendimiento](docs/COMPATIBILITY.md): dos APK separados, inspección de bibliotecas nativas, prueba en ARM de 32 bits y compilación iOS.

El prebuild Android confirma la configuración nativa de `armeabi-v7a`, `arm64-v8a`, API 24/36 y SQLCipher. No se considera verificado el soporte real de 32 bits hasta generar el APK y completar las pruebas en un dispositivo ARMv7.
