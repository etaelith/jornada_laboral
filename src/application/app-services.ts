import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { openAppDatabase } from '@/database/client';
import { AppRepository } from '@/database/repository';
import type { SessionWithBreaks, WorkProfile } from '@/domain/models';
import { ExpoAesGcmEncryption } from '@/security/encryption';

const DEVICE_ID_KEY = 'jornada.device-id.v1';

export interface Clock {
  now(): number;
  timezone(): string;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export interface AppServices {
  repository: AppRepository;
  profile: WorkProfile;
  clock: Clock;
}

let servicesPromise: Promise<AppServices> | undefined;

async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

export function getAppServices(): Promise<AppServices> {
  servicesPromise ??= initializeServices();
  return servicesPromise;
}

async function initializeServices(): Promise<AppServices> {
  const [context, deviceId] = await Promise.all([openAppDatabase(), getDeviceId()]);
  const encryption = await ExpoAesGcmEncryption.create(context.fieldKeyBase64);
  const repository = new AppRepository(context.db, encryption, deviceId);
  const profile = await repository.ensureDefaultProfile(systemClock.timezone());
  return { repository, profile, clock: systemClock };
}

export async function toggleWorkSession(): Promise<SessionWithBreaks> {
  const { repository, profile, clock } = await getAppServices();
  const open = await repository.getOpenSession(profile.id);
  if (open) return repository.stopSession(open.session.id, clock.now(), clock.timezone());
  return repository.startSession(profile.id, clock.now(), clock.timezone(), randomUUID());
}

export async function toggleBreak(isPaid = false): Promise<SessionWithBreaks> {
  const { repository, profile, clock } = await getAppServices();
  const open = await repository.getOpenSession(profile.id);
  if (!open) throw new Error('No hay una jornada abierta.');
  if (open.breaks.some((item) => !item.endedAtUtc)) {
    await repository.stopBreak(open.session.id, clock.now());
  } else {
    await repository.startBreak(open.session.id, clock.now(), isPaid);
  }
  const updated = await repository.getOpenSession(profile.id);
  if (!updated) throw new Error('No se pudo recuperar la jornada.');
  return updated;
}
