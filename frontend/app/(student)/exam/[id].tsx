import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, BackHandler, AppState, AppStateStatus, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../src/store/authStore';
import apiClient from '../../../src/api/client';
import { Button } from '../../../src/components/Button';
import { Input } from '../../../src/components/Input';

interface Question {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'short_answer';
  options?: { id: string; text: string }[];
  marks: number;
  image_base64?: string;
}

interface ExamData {
  id: string;
  title: string;
  duration_minutes: number;
  total_marks: number;
}

interface Answer {
  question_id: string;
  answer: string;
  time_taken_seconds: number;
}

export default function ExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [exam, setExam] = useState<ExamData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  
  const appState = useRef(AppState.currentState);
  const fraudEventsRef = useRef<number>(0);

  // Start exam session
  useEffect(() => {
    const startExam = async () => {
      try {
        const response = await apiClient.post(`/student/exams/${id}/start`);
        setSessionId(response.data.session_id);
        setExam(response.data.exam);
        setQuestions(response.data.questions);
        setTimeLeft(response.data.exam.duration_minutes * 60);
        
        // Load existing answers if resuming
        if (response.data.existing_answers?.length > 0) {
          const answerMap = new Map<string, string>();
          response.data.existing_answers.forEach((a: Answer) => {
            answerMap.set(a.question_id, a.answer);
          });
          setAnswers(answerMap);
        }
        
        setLoading(false);
      } catch (error: any) {
        Alert.alert('Error', error.response?.data?.detail || 'Failed to start exam');
        router.back();
      }
    };
    
    startExam();
  }, [id]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || loading) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit('Time expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [loading, timeLeft]);

  // Disable back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      logFraudEvent('back_button_pressed', 'Attempted to use back button during exam');
      return true; // Prevent default behavior
    });
    
    return () => backHandler.remove();
  }, [sessionId]);

  // Monitor app state changes (backgrounding)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [sessionId]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      // App went to background - major fraud event
      await logFraudEvent('app_backgrounded', 'App moved to background during exam', 25);
      fraudEventsRef.current += 1;
      
      if (fraudEventsRef.current >= 3) {
        handleAutoSubmit('Multiple fraud events detected');
      }
    }
    appState.current = nextAppState;
  };

  const logFraudEvent = async (fraudType: string, details: string, riskDelta: number = 10) => {
    if (!sessionId) return;
    
    try {
      const response = await apiClient.post('/student/fraud-event', {
        exam_session_id: sessionId,
        fraud_type: fraudType,
        details: details,
        risk_score_delta: riskDelta,
      });
      setRiskScore(response.data.risk_score);
    } catch (error) {
      console.error('Failed to log fraud event:', error);
    }
  };

  const handleAutoSubmit = async (reason: string) => {
    if (submitting) return;
    setSubmitting(true);
    
    try {
      await apiClient.post(`/student/exams/${id}/submit`);
      Alert.alert(
        'Exam Auto-Submitted',
        reason,
        [{ text: 'OK', onPress: () => router.replace('/(student)/dashboard') }]
      );
    } catch (error) {
      router.replace('/(student)/dashboard');
    }
  };

  const handleAnswerSelect = async (questionId: string, answer: string) => {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    
    // Check for suspiciously fast answers
    if (timeSpent < 2) {
      await logFraudEvent('fast_answer', `Answered in ${timeSpent} seconds`, 5);
    }
    
    setAnswers((prev) => new Map(prev).set(questionId, answer));
    
    // Save answer to server
    try {
      await apiClient.post(`/student/exams/${id}/answer`, {
        question_id: questionId,
        answer: answer,
        time_taken_seconds: timeSpent,
      });
    } catch (error) {
      console.error('Failed to save answer:', error);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setQuestionStartTime(Date.now());
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setQuestionStartTime(Date.now());
    }
  };

  const handleSubmitExam = () => {
    const unanswered = questions.length - answers.size;
    
    Alert.alert(
      'Submit Exam',
      unanswered > 0 
        ? `You have ${unanswered} unanswered questions. Are you sure you want to submit?`
        : 'Are you sure you want to submit your exam?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: submitExam },
      ]
    );
  };

  const submitExam = async () => {
    setSubmitting(true);
    try {
      const response = await apiClient.post(`/student/exams/${id}/submit`);
      Alert.alert(
        'Exam Submitted',
        `Your exam has been submitted successfully.\n\nMarks: ${response.data.marks_obtained}/${response.data.total_marks}`,
        [{ text: 'OK', onPress: () => router.replace('/(student)/dashboard') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit exam');
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading exam...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.get(currentQuestion?.id || '');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.examTitle} numberOfLines={1}>{exam?.title}</Text>
          <Text style={styles.questionCounter}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>
        <View style={[styles.timer, timeLeft < 300 && styles.timerWarning]}>
          <Ionicons name="time-outline" size={18} color={timeLeft < 300 ? '#EF4444' : '#10B981'} />
          <Text style={[styles.timerText, timeLeft < 300 && styles.timerTextWarning]}>
            {formatTime(timeLeft)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      {/* Question */}
      <ScrollView style={styles.questionContainer} contentContainerStyle={styles.questionContent}>
        <View style={styles.questionHeader}>
          <Text style={styles.marks}>{currentQuestion?.marks} mark{currentQuestion?.marks > 1 ? 's' : ''}</Text>
        </View>
        
        <Text style={styles.questionText}>{currentQuestion?.question_text}</Text>
        
        {currentQuestion?.question_type === 'mcq' && currentQuestion.options && (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  currentAnswer === option.id && styles.optionSelected,
                ]}
                onPress={() => handleAnswerSelect(currentQuestion.id, option.id)}
              >
                <View style={[
                  styles.optionRadio,
                  currentAnswer === option.id && styles.optionRadioSelected,
                ]}>
                  {currentAnswer === option.id && (
                    <View style={styles.optionRadioInner} />
                  )}
                </View>
                <Text style={[
                  styles.optionText,
                  currentAnswer === option.id && styles.optionTextSelected,
                ]}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {currentQuestion?.question_type === 'short_answer' && (
          <View style={styles.shortAnswerContainer}>
            <Input
              placeholder="Type your answer here (30-50 words)"
              value={currentAnswer || ''}
              onChangeText={(text) => handleAnswerSelect(currentQuestion.id, text)}
              multiline
              numberOfLines={4}
            />
          </View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={handlePrevQuestion}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={24} color={currentIndex === 0 ? '#4B5563' : '#F1F5F9'} />
          <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>Previous</Text>
        </TouchableOpacity>
        
        {currentIndex < questions.length - 1 ? (
          <TouchableOpacity style={[styles.navButton, styles.navButtonPrimary]} onPress={handleNextQuestion}>
            <Text style={styles.navButtonTextPrimary}>Next</Text>
            <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSubmit]}
            onPress={handleSubmitExam}
            disabled={submitting}
          >
            <Text style={styles.navButtonTextSubmit}>{submitting ? 'Submitting...' : 'Submit'}</Text>
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Question navigator */}
      <View style={styles.questionNav}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {questions.map((q, index) => (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.questionDot,
                index === currentIndex && styles.questionDotActive,
                answers.has(q.id) && styles.questionDotAnswered,
              ]}
              onPress={() => {
                setCurrentIndex(index);
                setQuestionStartTime(Date.now());
              }}
            >
              <Text style={[
                styles.questionDotText,
                index === currentIndex && styles.questionDotTextActive,
              ]}>
                {index + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F1F5F9',
  },
  questionCounter: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  timerWarning: {
    backgroundColor: '#7F1D1D',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  timerTextWarning: {
    color: '#EF4444',
  },
  progressContainer: {
    height: 3,
    backgroundColor: '#1E293B',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4F46E5',
  },
  questionContainer: {
    flex: 1,
  },
  questionContent: {
    padding: 20,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 16,
  },
  marks: {
    fontSize: 13,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  questionText: {
    fontSize: 18,
    color: '#F1F5F9',
    lineHeight: 28,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },
  optionSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#1E1B4B',
  },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4B5563',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: {
    borderColor: '#4F46E5',
  },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4F46E5',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#E2E8F0',
  },
  optionTextSelected: {
    color: '#A5B4FC',
  },
  shortAnswerContainer: {
    marginTop: 8,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 12,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonPrimary: {
    backgroundColor: '#4F46E5',
  },
  navButtonSubmit: {
    backgroundColor: '#10B981',
  },
  navButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#F1F5F9',
  },
  navButtonTextDisabled: {
    color: '#4B5563',
  },
  navButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navButtonTextSubmit: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  questionNav: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  questionDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  questionDotActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#1E1B4B',
  },
  questionDotAnswered: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  questionDotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  questionDotTextActive: {
    color: '#A5B4FC',
  },
});
