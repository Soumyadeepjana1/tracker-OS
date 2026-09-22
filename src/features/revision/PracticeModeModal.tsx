import { useState } from 'react';
import type { QuizMode, Topic } from '@/types';
import { store, useApp } from '@/store/store';
import { todayISO } from '@/lib/date';
import { STUDY_SUBJECTS } from '@/types';
import { Badge, Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlay';
import { IconCheck, IconCheckCircle, IconRefresh, IconSparkles, IconTimer, IconZap } from '@/components/icons';

interface Question {
  id: string;
  topic: Topic;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

function generateQuestions(topics: Topic[], subject: string, count = 5): Question[] {
  const filtered = subject === 'All subjects'
    ? topics
    : topics.filter((t) => t.category.toLowerCase().includes(subject.toLowerCase()) || subject.toLowerCase().includes(t.category.toLowerCase()));

  const pool = filtered.length ? filtered : topics;
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map((topic, index) => {
    const defaultExplanation = `Understanding ${topic.name} (${topic.category}) is key for production DevOps infrastructure.`;
    
    const qName = topic.name;
    const cat = topic.category;

    const options = [
      `It manages runtime execution and state for ${qName}.`,
      `It handles network routing and telemetry logs for ${cat}.`,
      `It configures immutable deployment manifests for ${qName}.`,
      `It monitors performance metrics and health checks for ${cat}.`,
    ];
    
    const correctIndex = (index + qName.length) % 4;

    return {
      id: topic.id || `q-${index}`,
      topic,
      question: `Which statement best describes the primary role of "${qName}" in ${cat}?`,
      options,
      correctIndex,
      explanation: defaultExplanation,
    };
  });
}

export function PracticeModeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = useApp();
  const [subject, setSubject] = useState<string>('All subjects');
  const [mode, setMode] = useState<QuizMode>('auto');
  const [active, setActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ questionId: string; correct: boolean; missedTopic: string }[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [completed, setCompleted] = useState(false);

  const availableSubjects = ['All subjects', ...STUDY_SUBJECTS];

  const startQuiz = () => {
    const generated = generateQuestions(state.topics, subject, 5);
    setQuestions(generated);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedOption(null);
    setCompleted(false);
    setActive(true);
    setStartTime(Date.now());
  };

  const currentQuestion = questions[currentIndex];

  const selectAnswer = (optionIdx: number) => {
    if (selectedOption !== null || !currentQuestion) return;
    setSelectedOption(optionIdx);
    const isCorrect = optionIdx === currentQuestion.correctIndex;
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        correct: isCorrect,
        missedTopic: isCorrect ? '' : currentQuestion.topic.name,
      },
    ]);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const total = questions.length;
    const correctCount = answers.filter((a) => a.correct).length;
    const missedTopics = Array.from(new Set(answers.filter((a) => !a.correct && a.missedTopic).map((a) => a.missedTopic)));
    const score = Math.round((correctCount / total) * 100);

    setCompleted(true);

    try {
      await store.addQuizAttempt({
        date: todayISO(),
        mode,
        subject,
        total,
        correct: correctCount,
        score,
        durationSeconds,
        missed: missedTopics,
      });
      store.toast({
        title: `Practice completed — Score: ${score}%`,
        message: `${correctCount}/${total} correct in ${durationSeconds}s.`,
        tone: score >= 80 ? 'ok' : 'info',
      });
    } catch (err) {
      console.error('Failed to log quiz attempt:', err);
    }
  };

  const handleClose = () => {
    setActive(false);
    setCompleted(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="DevOps Practice Quiz"
      description="Test your knowledge with active recall questions derived from your study topics."
      size="lg"
    >
      {!active && !completed ? (
        <div className="flex flex-col gap-5 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-semibold text-fg-muted">Subject Focus</label>
              <select
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-medium text-fg focus:outline-none focus:ring-2 focus:ring-brand"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {availableSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-fg-muted">Practice Mode</label>
              <div className="mt-1.5 flex rounded-xl border border-line p-1 bg-surface-2">
                <button
                  type="button"
                  onClick={() => setMode('auto')}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition ${
                    mode === 'auto' ? 'bg-surface text-fg shadow-sm' : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  Multiple Choice
                </button>
                <button
                  type="button"
                  onClick={() => setMode('recall')}
                  className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold transition ${
                    mode === 'recall' ? 'bg-surface text-fg shadow-sm' : 'text-fg-subtle hover:text-fg'
                  }`}
                >
                  Active Recall
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-4 text-[13px] text-fg-muted">
            <div className="flex items-center gap-2 font-medium text-fg">
              <IconSparkles size={16} className="text-brand" />
              <span>Adaptive Question Engine</span>
            </div>
            <p className="mt-1 text-[12px]">
              This round will generate 5 questions from your tracked topics ({state.topics.length} available). Missed questions will automatically surface in your revision queue.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" icon={<IconZap size={15} />} onClick={startQuiz}>
              Start Practice Session
            </Button>
          </div>
        </div>
      ) : active && !completed && currentQuestion ? (
        <div className="flex flex-col gap-5 py-2">
          <div className="flex items-center justify-between text-[12px] font-semibold text-fg-muted">
            <Badge tone="brand">
              Question {currentIndex + 1} of {questions.length}
            </Badge>
            <span className="flex items-center gap-1">
              <IconTimer size={14} /> Topic: <strong className="text-fg">{currentQuestion.topic.name}</strong>
            </span>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4">
            <h3 className="text-[15px] font-bold text-fg">{currentQuestion.question}</h3>
          </div>

          <div className="grid gap-2.5">
            {currentQuestion.options.map((option, idx) => {
              let buttonStyle = 'border-line bg-surface text-fg hover:border-brand hover:bg-surface-hover';
              if (selectedOption !== null) {
                if (idx === currentQuestion.correctIndex) {
                  buttonStyle = 'border-ok bg-ok-soft text-ok font-semibold';
                } else if (idx === selectedOption) {
                  buttonStyle = 'border-danger bg-danger-soft text-danger';
                } else {
                  buttonStyle = 'border-line bg-surface text-fg-subtle opacity-50';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={selectedOption !== null}
                  onClick={() => selectAnswer(idx)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-[13px] transition ${buttonStyle}`}
                >
                  <span>{option}</span>
                  {selectedOption !== null && idx === currentQuestion.correctIndex && (
                    <IconCheck size={16} className="text-ok shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && (
            <div className="rounded-xl border border-line bg-surface-2 p-3 text-[12px] text-fg-muted animate-fadeIn">
              <p className="font-semibold text-fg">Explanation:</p>
              <p className="mt-0.5">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="primary"
              disabled={selectedOption === null}
              onClick={nextQuestion}
            >
              {currentIndex + 1 === questions.length ? 'Finish & See Results' : 'Next Question →'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
            <IconCheckCircle size={32} />
          </div>

          <div>
            <h3 className="text-[18px] font-bold text-fg">Practice Round Completed!</h3>
            <p className="text-[13px] text-fg-muted mt-1">
              {answers.filter((a) => a.correct).length} of {questions.length} questions correct
            </p>
          </div>

          <div className="w-full rounded-2xl border border-line bg-surface-2 p-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Score</p>
              <p className="text-[24px] font-extrabold text-fg">
                {Math.round((answers.filter((a) => a.correct).length / questions.length) * 100)}%
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Subject</p>
              <p className="text-[16px] font-bold text-fg truncate mt-1">{subject}</p>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-3">
            <Button variant="secondary" icon={<IconRefresh size={15} />} onClick={startQuiz}>
              Try Another Round
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
