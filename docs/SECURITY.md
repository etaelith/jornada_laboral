# Seguridad y privacidad — Fase 1

## Modelo de amenazas

Se protege principalmente contra lectura del archivo de base de datos, backups del sistema, logs, archivos temporales y acceso casual a una aplicación desbloqueada. No se promete protección total en un dispositivo rooteado/jailbreakeado, comprometido mientras la app está desbloqueada o bajo instrumentación del sistema operativo.

## Diseño elegido

Defensa en profundidad:

1. `expo-sqlite` con SQLCipher cifra la base completa en builds nativos.
2. Campos de alto riesgo y payloads destinados a backup/sincronización usan AES-256-GCM por registro con nonce aleatorio de 12 bytes, etiqueta de 16 bytes y AAD que liga tabla, id, campo y versión.
3. `expo-secure-store` guarda un llavero pequeño protegido por Keychain en iOS y Keystore en Android; ninguna clave entra en SQLite.
4. La aplicación usa development builds y builds de producción; SQLCipher y autenticación biométrica no se validan con Expo Go.

SQLCipher queda condicionado al *spike* ARMv7. Si sus binarios no superan la prueba de 32 bits, se elimina SQLCipher y se amplía el cifrado de campo a todo dato laboral sensible, sin debilitar AES-GCM.

## Ciclo de claves

- En el primer inicio se generan con CSPRNG una clave maestra de campos y una clave independiente de base, ambas de 256 bits; juntas forman el llavero local versionado. La separación evita reutilizar una misma clave entre AES-GCM y SQLCipher.
- SecureStore guarda el llavero con accesibilidad `WHEN_UNLOCKED_THIS_DEVICE_ONLY` cuando la plataforma lo soporte.
- La clave biométrica es un envoltorio o puerta de acceso, no la única copia lógica: cambiar biometría no debe destruir silenciosamente la clave de datos.
- Cada cifrado deja `keyId` y versión. La rotación crea una clave nueva, cifra nuevas escrituras con ella y migra registros por lotes; las claves antiguas solo se retiran después de verificación completa.
- Las claves viven el menor tiempo posible en memoria y nunca aparecen en Redux/Zustand, errores o logs.

No se reutilizan nonces y no se implementan primitivas criptográficas propias. Se usará la API AES-GCM de `expo-crypto`, que genera `AESSealedData` autenticado.

## Pérdida o inaccesibilidad

Si SecureStore devuelve ausencia/invalidez y existe una base:

1. no se crea una clave nueva ni se sobrescribe la base;
2. se bloquea toda escritura;
3. se muestra un estado de recuperación sin datos descifrados;
4. se ofrece restaurar una copia cifrada o borrar explícitamente los datos locales con doble confirmación;
5. se registra solo un código técnico no sensible.

En Android se excluyen SecureStore y la base cifrada del Auto Backup no coordinado. En iOS no se confía en la persistencia del Keychain tras reinstalar. La copia manual cifrada será el mecanismo recuperable.

## Datos cifrados y datos visibles

Con SQLCipher cerrado, todas las páginas de la base quedan cifradas. Dentro de la base abierta, además se cifran: nombres de perfil y empresa, notas, razones y snapshots de revisión, etiqueta de dispositivo y payloads de backup/sync.

Quedan como columnas consultables: UUID aleatorios, relaciones, instantes UTC, zonas IANA, estado, fuente, clasificación, minutos objetivo, flags y metadatos de versión. Son necesarios para índices, rangos, reglas e identificación de conflictos sin descifrar colecciones completas. Se consideran sensibles; por eso dependen de SQLCipher en reposo. Si SQLCipher se descarta, esos campos se dividirán entre índices derivados mínimos y payload cifrado, y se documentará la fuga residual antes de liberar.

## Bloqueo de aplicación

- Biometría opcional mediante APIs nativas de autenticación local.
- PIN opcional con KDF resistente a fuerza bruta, salt aleatorio, límite progresivo y verificador en SecureStore; la elección concreta de KDF requiere auditoría ABI antes de Fase 7.
- Al pasar a segundo plano se oculta el contenido y se invalida la sesión según el tiempo configurado.
- Las notificaciones no incluyen nombres, notas ni horarios exactos en pantalla bloqueada por defecto.

## Logs y errores

Producción usa códigos y contexto estructural permitido: operación, versión de esquema y clase de error. Se prohíben jornadas, horas, notas, claves, nonces con ciphertext, SQL con valores y datos descifrados. Los *source maps* y artefactos de depuración se conservan en un canal privado y no se incluye un logger remoto en el MVP.

## Copias manuales

Formato versionado con cabecera mínima, salt, parámetros KDF, nonce y ciphertext autenticado. La contraseña nunca se guarda. La restauración valida versión y autenticidad antes de previsualizar, detecta conflictos y aplica reemplazo/mezcla dentro de una transacción. La KDF y parámetros se seleccionarán tras medir ARMv7; no se inventará una derivación propia.

## Sincronización E2E futura

`SyncProvider` solo recibe sobres cifrados. Se prevén identidad de usuario, claves por dispositivo, incorporación/revocación, firmas o autenticación de mensajes, contadores anti-replay, versiones, tombstones y resolución determinista de conflictos. Recuperar una cuenta no equivaldrá a recuperar claves de datos.
