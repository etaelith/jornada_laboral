# Compatibilidad y rendimiento — Fase 1

Fecha de decisión: 16 de julio de 2026.

## Matriz de plataforma propuesta

| Elemento | Versión elegida | Motivo | Compatibilidad mínima |
| --- | ---: | --- | --- |
| Expo SDK | 55.0.0; paquetes de parche fijados por lockfile | API 36 con iOS 15.1; mejor cobertura que SDK 56/57 | Android 7 / iOS 15.1 |
| React Native | 0.83.0 | Pareja soportada oficialmente por Expo SDK 55 | Android e iOS de Expo 55 |
| React | 19.2.0 | Pareja de Expo 55 | Igual que Expo |
| Android minSdk | 24 | Mínimo oficial de Expo 55 | Android 7.0 |
| Android targetSdk | 36 | Requisito Play para nuevas apps desde 31-08-2026 | Android 16 target |
| Android compileSdk | 36 | Pareja oficial de Expo 55 | Android SDK 36 |
| Android ABI producción | `armeabi-v7a`, `arm64-v8a` | Cobertura ARM 32/64; AAB entrega *splits* | ARMv7 y ARM64 |
| iOS deployment target | 15.1 | Mínimo de Expo 55 y mayor cobertura que SDK 56/57 | iPhone/iPad de 64 bits con iOS 15.1 |
| Xcode | 26.2 (17C52) | Imagen EAS de SDK 55 y cumple exigencia Xcode/iOS SDK 26 | macOS Sequoia 15.6 en EAS |
| Node.js | 20.19.4 | Imagen reproducible EAS SDK 55 | 20.19.x |
| JDK | 17 | Imagen EAS SDK 55 y recomendación RN | Java 17 |
| NDK | 27.1.12297006 | Imagen EAS SDK 55 | ARMv7/ARM64 por verificar en artefacto |
| SQLite | `expo-sqlite` de Expo 55 | Integración oficial, migraciones, cursores, SQLCipher | Ambas plataformas; no Expo Go |
| Criptografía | `expo-crypto` de Expo 55, AES-256-GCM | API oficial, autenticada, nonce nativo | Ambas plataformas; ABI por probar |
| Claves | `expo-secure-store` de Expo 55 | Keychain/Keystore oficiales | Android API 24 / iOS 15.1 |

No se elige SDK 57 porque eleva iOS a 16.4 y Node 22 sin una necesidad funcional. SDK 55 ya apunta a API 36 y App Store exige compilar con Xcode 26/iOS 26 SDK, condición que Xcode 26.2 satisface.

## Configuración ABI prevista para Fase 2

`expo-build-properties` 55 documenta `android.buildArchs`; se fijará a `['armeabi-v7a', 'arm64-v8a']` en producción. Los perfiles internos generarán APK separados mediante tareas Gradle ABI-specific o *splits*, y producción un AAB. `x86`/`x86_64` se reservarán para emulador.

La presencia de la propiedad no demuestra que todas las bibliotecas incluyan ARMv7. Cada `.so` se inspeccionará y la aplicación se ejecutará en hardware real.

## Spike obligatorio antes de Fase 2

Estado: **pendiente; bloqueo consciente**. No se creó código en Fase 1.

1. Crear un proyecto mínimo Expo 55 reproducible con lockfile y development build.
2. Incorporar Router, SQLite+SQLCipher, SecureStore y Crypto; sin pantallas de producto.
3. Fijar ABIs ARMv7/ARM64 y ejecutar `prebuild --clean`.
4. Generar AAB, APK ARMv7 y APK ARM64; listar ABIs con `apkanalyzer`/`unzip` y validar ELF de cada `.so`.
5. Instalar ARMv7 en dispositivo de 1–2 GB; abrir, crear base cifrada, cifrar/descifrar AES-GCM, reiniciar y repetir.
6. Instalar ARM64 y repetir.
7. Compilar iOS con Xcode 26.2 para deployment target 15.1 y probar SecureStore/SQLCipher.
8. Medir tamaño, RSS, inicio frío y latencia p95; registrar resultados en este documento.

Criterio de salida: todos los pasos aprobados. Si SQLCipher o cualquier dependencia falla ARMv7, se reemplaza o se adopta cifrado de campos completo antes de implementar dominio.

## Presupuestos iniciales medibles

Se confirmarán en los dispositivos de referencia; son umbrales de aceptación, no resultados medidos:

| Métrica | Objetivo inicial |
| --- | ---: |
| Inicio frío hasta fichaje interactivo, Android ARMv7 | p95 ≤ 3.0 s |
| Inicio frío ARM64/iPhone compatible | p95 ≤ 2.0 s |
| Entrada/salida confirmada localmente | p95 ≤ 250 ms |
| Inicio/fin de pausa | p95 ≤ 250 ms |
| Frames lentos en flujo principal | < 5% |
| RSS estable en ARMv7 durante fichaje/calendario | ≤ 180 MB |
| Aumento de RSS tras 20 ciclos de navegación | ≤ 15 MB |
| APK por ABI release comprimido | ≤ 35 MB |
| Consulta de mes con 10 años de datos | p95 ≤ 150 ms |
| Primera página de historial (50 elementos) | p95 ≤ 150 ms |
| Exportación CSV de 10 años | sin bloqueo UI > 100 ms; memoria adicional ≤ 30 MB |

Se medirán al menos 20 corridas de inicio y 100 operaciones de fichaje después de calentamiento. Una regresión superior al 15% bloquea la fase correspondiente.

## Dispositivos de referencia

- ARMv7 físico, Android 7–9, 1–2 GB, almacenamiento lento y pantalla pequeña.
- ARM64 físico, Android 8–10, 2 GB.
- Android actual de gama media con Android 16.
- iPhone 6s/SE 1.ª generación con iOS 15.1 si está disponible; en su defecto el hardware más antiguo disponible que ejecute iOS 15.1, documentando la desviación.
- iPhone actual con iOS 26.

Emuladores sirven para matriz funcional, no para aceptar memoria, biometría, almacenamiento, batería ni ARMv7.

## Reglas de rendimiento

- Consultas por rango y cursor, límites obligatorios y sentencias preparadas.
- Historial virtualizado; calendario renderiza solo el mes visible.
- Estadísticas diferidas, memorizadas por rango y recalculadas fuera del render.
- Cifrado/importación/exportación por lotes con cesión periódica al event loop o módulo nativo medido.
- Contador aislado; no persiste ticks ni actualiza la raíz.
- Sin blur, vídeo, partículas, gradientes animados ni motor de animación adicional.
- Tema de efectos reducidos que elimina sombras/transparencias decorativas.
- Prueba con diez años simulados y `EXPLAIN QUERY PLAN` antes de conservar índices.

## Fuentes oficiales verificadas

- Expo SDK 55: https://docs.expo.dev/versions/v55.0.0/
- Expo Build Properties 55: https://docs.expo.dev/versions/v55.0.0/sdk/build-properties/
- Infraestructura EAS: https://docs.expo.dev/build-reference/infrastructure/
- Requisito target API de Play: https://developer.android.com/google/play/requirements/target-sdk
- Requisitos App Store: https://developer.apple.com/news/upcoming-requirements/
- Soporte Xcode: https://developer.apple.com/support/xcode
