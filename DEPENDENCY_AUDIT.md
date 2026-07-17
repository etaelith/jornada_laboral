# Auditoría inicial de dependencias

Fecha: 16 de julio de 2026. Estado: decisión de Fase 1; versiones de parche exactas se fijarán mediante `expo install` y lockfile después del spike.

## Criterios

Antes de aceptar una dependencia se registra: función nativa equivalente, código nativo, ABI ARMv7, mínimos OS, tamaño incremental medido, memoria, nueva arquitectura, Google Play Services, funcionamiento offline, telemetría, licencia, mantenimiento y prueba de compilación.

`Desconocido` significa que no se afirmará compatibilidad hasta inspeccionar el artefacto y ejecutar el spike.

## Base propuesta

| Paquete | Decisión y motivo | Código nativo / ARMv7 | Red/telemetría | Riesgo / verificación |
| --- | --- | --- | --- | --- |
| `expo` SDK 55 / RN 0.83 | Base fijada por compatibilidad de tiendas e iOS 15.1 | Sí / propiedad ABI disponible; ejecución pendiente | No obligatoria / sin telemetría de producto | Verificar cada `.so`, memoria y nueva arquitectura |
| `expo-router` compatible SDK 55 | Navegación oficial y *deep links* | Usa base Expo / heredado | Offline / ninguna de producto | Medir arranque y rutas |
| `expo-sqlite` compatible SDK 55 | SQLite oficial, cursores, migraciones y SQLCipher | Sí / ARMv7 pendiente | Offline / no | Mayor riesgo: SQLCipher ABI, tamaño y rendimiento |
| `drizzle-orm` + `drizzle-kit` | Tipado y migraciones SQL revisables; runtime JS | No en runtime / no aplica | Offline / no | Fijar versión, licencia y tamaño; repositorios aíslan reemplazo |
| `expo-secure-store` compatible SDK 55 | Keychain/Keystore sin paquete externo | Sí / pendiente integrada | Offline / no | Invalidación biométrica y reinstalación |
| `expo-crypto` compatible SDK 55 | AES-GCM y CSPRNG oficiales | Sí / pendiente integrada | Offline / no | Vectores conocidos, manipulación y rendimiento ARMv7 |
| `expo-local-authentication` | Biometría, solo Fase 7 | Sí / pendiente | Offline / no | No bloquear datos por cambio biométrico |
| `react-hook-form` | Formularios con renders acotados | No | Offline / no | Medir formularios extensos |
| `zod` | Validación compartida e importación por fila | No | Offline / no | Procesar lotes para no congelar UI |
| `zustand` | Estado global mínimo y pequeño | No | Offline / no | Prohibido guardar historiales/entidades persistidas |
| `date-fns` + `@date-fns/tz` | Funciones modulares y zonas IANA | No | Offline / no | Probar DST, bundles de zona e Intl en Hermes |
| Jest + React Native Testing Library | Unitarias/componentes | Solo desarrollo | Offline / no | Configuración compatible Expo 55 |
| Maestro | E2E en builds reales, ya presente en imagen EAS | Herramienta externa | Puede operar local | Probar ARMv7 con hardware conectado |

Todas las licencias deberán registrarse con versión exacta en Fase 2; se aceptan inicialmente paquetes del ecosistema Expo/React con licencias permisivas, sujetos a verificación automática del árbol transitivo.

## Paquetes deliberadamente no elegidos

- AsyncStorage para jornadas: prohibido; la fuente de verdad es SQLite.
- Redux Toolkit: innecesario para el estado efímero previsto; Zustand reduce superficie y tamaño.
- Motor de animaciones o gráficos: no aporta al flujo principal y penaliza ARMv7.
- Biblioteca criptográfica general externa: `expo-crypto` 55 ya ofrece AES-GCM; se evita otra dependencia nativa.
- ORM con runtime pesado o reflexión: Drizzle genera SQL explícito y deja repositorios testeables.
- SDK de analítica/crash remoto: fuera del MVP privacy-first.

## Dependencias aplazadas

XLSX, PDF, KDF de backup/PIN y procesamiento en segundo plano se auditarán justo antes de sus fases. No se seleccionan ahora porque sus tamaños y ABIs pueden cambiar y no son necesarias para Fases 2–5. Se preferirán generación incremental y APIs Expo/nativas; ninguna se incorporará sin APK ARMv7.

## Plantilla de aceptación

Para cada nueva dependencia se añadirá una fila con:

```text
Nombre y versión exacta:
Necesidad / alternativa de plataforma:
Licencia y mantenimiento:
Código nativo y ABIs inspeccionadas:
minSdk / iOS mínimo / nueva arquitectura:
Google Play Services / red / telemetría:
Delta AAB-APK y RSS medidos:
Pruebas ARMv7, ARM64 e iOS:
Decisión y responsable/fecha:
```
