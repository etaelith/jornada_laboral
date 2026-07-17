import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, TextInput } from 'react-native';
import { z } from 'zod';

import { useApp } from '@/application/app-context';
import { getAppServices } from '@/application/app-services';
import { AppButton, Body, Card, ErrorState, Heading, Screen } from '@/shared/ui';
import { useTheme } from '@/shared/theme';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá un nombre.'),
  companyName: z.string().trim(),
  expectedMinutesPerDay: z.coerce.number().int().min(0).max(1_440),
  expectedMinutesPerWeek: z.coerce.number().int().min(0).max(10_080),
  timezone: z.string().min(1),
});

type ProfileForm = z.input<typeof profileSchema>;

export default function ProfileScreen() {
  const app = useApp();
  const theme = useTheme();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const { control, handleSubmit } = useForm<ProfileForm>({
    values: {
      name: app.profile?.name ?? '',
      companyName: app.profile?.companyName ?? '',
      expectedMinutesPerDay: app.profile?.expectedMinutesPerDay ?? 480,
      expectedMinutesPerWeek: app.profile?.expectedMinutesPerWeek ?? 2_400,
      timezone: app.profile?.timezone ?? 'UTC',
    },
  });

  const submit = handleSubmit(async (raw) => {
    const result = profileSchema.safeParse(raw);
    if (!result.success || !app.profile) {
      setError(result.error?.issues[0]?.message ?? 'El perfil todavía no está disponible.');
      return;
    }
    try {
      const services = await getAppServices();
      await services.repository.saveProfile({
        ...app.profile,
        ...result.data,
        ...(result.data.companyName ? { companyName: result.data.companyName } : {}),
        updatedAtUtc: Date.now(),
      });
      await app.refresh();
      setSaved(true);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el perfil.');
    }
  });

  const fields: {
    name: keyof ProfileForm;
    label: string;
    keyboard?: 'default' | 'number-pad';
  }[] = [
    { name: 'name', label: 'Nombre del perfil' },
    { name: 'companyName', label: 'Empresa (opcional)' },
    { name: 'expectedMinutesPerDay', label: 'Objetivo diario, minutos', keyboard: 'number-pad' },
    { name: 'expectedMinutesPerWeek', label: 'Objetivo semanal, minutos', keyboard: 'number-pad' },
    { name: 'timezone', label: 'Zona horaria IANA' },
  ];

  return (
    <Screen>
      <Heading>Perfil laboral</Heading>
      <Body muted>
        Los nombres se guardan cifrados. Los objetivos se utilizan para horas extra y faltantes.
      </Body>
      {error ? <ErrorState message={error} /> : null}
      {saved ? (
        <Card>
          <Body>✓ Cambios guardados.</Body>
        </Card>
      ) : null}
      {fields.map((field) => (
        <Controller
          key={field.name}
          control={control}
          name={field.name}
          render={({ field: input }) => (
            <TextInput
              accessibilityLabel={field.label}
              placeholder={field.label}
              placeholderTextColor={theme.muted}
              keyboardType={field.keyboard ?? 'default'}
              value={String(input.value)}
              onBlur={input.onBlur}
              onChangeText={input.onChange}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
              ]}
            />
          )}
        />
      ))}
      <AppButton label="Guardar perfil" onPress={() => void submit()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16 },
});
