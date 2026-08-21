import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { parseScheduleInput } from '@/lib/parse-schedule';
import { formatDueAt, WEEKDAY_NAMES, type RecurrenceFreq } from '@/lib/recurrence';
import {
  deleteReminder,
  getReminder,
  skipReminderOccurrence,
  snoozeReminder,
  updateReminderSchedule,
  type Reminder,
} from '@/lib/reminders';

const FREQ_OPTIONS: { label: string; value: RecurrenceFreq | null }[] = [
  { label: 'None', value: null },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

export default function ReminderEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const tintColor = Colors[colorScheme].tint;

  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [freq, setFreq] = useState<RecurrenceFreq | null>(null);
  const [weekday, setWeekday] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scheduleText, setScheduleText] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    getReminder(id).then(({ data, error }) => {
      if (error || !data) {
        setErrorMessage(error?.message ?? 'Reminder not found');
      } else {
        setReminder(data);
        setDueAt(data.due_at ? new Date(data.due_at) : null);
        setFreq(data.recurrence_freq);
        setWeekday(data.recurrence_weekday);
      }
      setIsLoading(false);
    });
  }, [id]);

  function handleQuickParse() {
    const parsed = parseScheduleInput(scheduleText);
    if (!parsed) {
      setScheduleError('Couldn\'t understand that — try "8/25/26", "next Tue", or "every Tue at 11a".');
      return;
    }
    setScheduleError(null);
    setScheduleText('');
    setDueAt(parsed.dueAt);
    setFreq(parsed.recurrenceFreq);
    setWeekday(parsed.recurrenceWeekday);
  }

  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);
    const { data, error } = await updateReminderSchedule(id, {
      due_at: dueAt ? dueAt.toISOString() : null,
      recurrence_freq: dueAt ? freq : null,
      recurrence_weekday: dueAt && freq === 'weekly' ? weekday : null,
    });
    setIsSaving(false);
    if (error) {
      setErrorMessage(error.message);
    } else if (data) {
      router.back();
    }
  }

  async function handleSnooze() {
    if (!reminder) return;
    setIsSaving(true);
    const { error } = await snoozeReminder(reminder);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.back();
    }
  }

  async function handleSkip() {
    if (!reminder) return;
    setIsSaving(true);
    const { error } = await skipReminderOccurrence(reminder);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.back();
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    const { error } = await deleteReminder(id);
    setIsSaving(false);
    if (error) {
      setErrorMessage(error.message);
    } else {
      router.back();
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!reminder) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{errorMessage ?? 'Reminder not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{reminder.title}</Text>

      <Text style={styles.sectionLabel}>Quick schedule</Text>
      <TextInput
        style={[styles.quickInput, { color: Colors[colorScheme].text, borderColor: tintColor }]}
        value={scheduleText}
        onChangeText={setScheduleText}
        placeholder='e.g. "next Tue", 8/25/26, "every Tue at 11a"'
        placeholderTextColor="#888"
        onSubmitEditing={handleQuickParse}
        returnKeyType="done"
      />
      {scheduleError ? <Text style={styles.error}>{scheduleError}</Text> : null}

      <Text style={styles.sectionLabel}>Due date</Text>
      <Text>{dueAt ? formatDueAt(dueAt.toISOString()) : 'Not set'}</Text>
      {dueAt && (
        <Pressable
          onPress={() => {
            setDueAt(null);
            setFreq(null);
            setWeekday(null);
          }}>
          <Text style={styles.link}>Clear due date</Text>
        </Pressable>
      )}

      {dueAt && (
        <>
          <Text style={styles.sectionLabel}>Repeat</Text>
          <View style={styles.optionRow}>
            {FREQ_OPTIONS.map((option) => {
              const isActive = option.value === freq;
              return (
                <Pressable
                  key={option.label}
                  style={[styles.optionButton, { borderColor: tintColor }, isActive && { backgroundColor: tintColor }]}
                  onPress={() => {
                    setFreq(option.value);
                    if (option.value !== 'weekly') setWeekday(null);
                  }}>
                  <Text style={isActive ? { color: '#fff' } : { color: tintColor }}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {freq === 'weekly' && (
            <>
              <Text style={styles.sectionLabel}>On</Text>
              <View style={styles.optionRow}>
                <Pressable
                  style={[styles.optionButton, { borderColor: tintColor }, weekday === null && { backgroundColor: tintColor }]}
                  onPress={() => setWeekday(null)}>
                  <Text style={weekday === null ? { color: '#fff' } : { color: tintColor }}>Any day</Text>
                </Pressable>
                {WEEKDAY_NAMES.map((name, index) => {
                  const isActive = weekday === index;
                  return (
                    <Pressable
                      key={name}
                      style={[styles.optionButton, { borderColor: tintColor }, isActive && { backgroundColor: tintColor }]}
                      onPress={() => setWeekday(index)}>
                      <Text style={isActive ? { color: '#fff' } : { color: tintColor }}>{name.slice(0, 3)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <Pressable style={[styles.saveButton, { backgroundColor: tintColor }]} onPress={handleSave} disabled={isSaving}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>

      {reminder.due_at && (
        <Pressable style={styles.secondaryButton} onPress={handleSnooze} disabled={isSaving}>
          <Text style={{ color: tintColor }}>Snooze 1 day</Text>
        </Pressable>
      )}

      {reminder.recurrence_freq && (
        <Pressable style={styles.secondaryButton} onPress={handleSkip} disabled={isSaving}>
          <Text style={{ color: tintColor }}>Skip this occurrence</Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryButton} onPress={handleDelete} disabled={isSaving}>
        <Text style={styles.deleteText}>Delete reminder</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    marginTop: 12,
    marginBottom: 4,
  },
  link: {
    textDecorationLine: 'underline',
    marginTop: 6,
  },
  quickInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  error: {
    color: '#e53e3e',
    marginTop: 12,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#e53e3e',
  },
});
