# Jornada laboral

Aplicación móvil local-first para registrar jornadas laborales privadas en Android e iOS.

## Estado

El repositorio contiene únicamente la **Fase 1: definición**. No se ha creado todavía el proyecto Expo ni se han instalado dependencias.

Documentos de la fase:

- [Arquitectura y navegación](docs/ARCHITECTURE.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Seguridad y privacidad](docs/SECURITY.md)
- [Compatibilidad y rendimiento](docs/COMPATIBILITY.md)
- [Auditoría inicial de dependencias](DEPENDENCY_AUDIT.md)
- [Riesgos y plan incremental](docs/IMPLEMENTATION_PLAN.md)

## Decisión de continuidad

La base propuesta es Expo SDK 55 / React Native 0.83, Android API 24–36, ABIs `armeabi-v7a` y `arm64-v8a`, e iOS 15.1+. Antes de comenzar la Fase 2 debe superarse el *spike* nativo descrito en [Compatibilidad y rendimiento](docs/COMPATIBILITY.md): dos APK separados, inspección de bibliotecas nativas, prueba en ARM de 32 bits y compilación iOS.

No se considera verificado el soporte de 32 bits hasta completar esa prueba en un dispositivo real.
