import type {
  Course,
  CourseModule,
  Difficulty,
  ISODate,
  Lesson,
  Note,
  Project,
  RevisionRecord,
  StudySession,
  StudyTask,
  Topic,
  TopicStatus,
} from '@/types';
import { addDays, todayISO } from '@/lib/date';
import { uid } from '@/lib/utils';

/**
 * Realistic starting data for a DevOps learner.
 *
 * Everything is generated relative to *today* so the dashboard, streak and
 * heatmap look alive on first run. The Settings page can wipe it at any time
 * ("Reset application").
 */

export interface SampleData {
  courses: Course[];
  topics: Topic[];
  tasks: StudyTask[];
  projects: Project[];
  notes: Note[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
}

const now = () => new Date().toISOString();

function makeLesson(title: string, durationMinutes: number, status: Lesson['status'] = 'not-started'): Lesson {
  return {
    id: uid('lsn'),
    title,
    durationMinutes,
    status,
    notes: '',
    needsRevision: status === 'completed' && Math.random() < 0.25,
  };
}

function makeModule(title: string, lessons: Lesson[]): CourseModule {
  return { id: uid('mod'), title, lessons };
}

function course(
  partial: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'modules'> & { modules?: CourseModule[] },
): Course {
  const timestamp = now();
  return {
    id: uid('crs'),
    modules: partial.modules ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...partial,
  };
}

function topic(
  name: string,
  category: string,
  status: TopicStatus,
  progress: number,
  options: {
    confidence?: Topic['confidence'];
    difficulty?: Difficulty;
    lastStudiedDaysAgo?: number;
    nextRevisionInDays?: number | null;
    revisionCount?: number;
    notes?: string;
    resourceUrl?: string;
  } = {},
): Topic {
  const timestamp = now();
  const today = todayISO();
  return {
    id: uid('tpc'),
    name,
    category,
    status,
    progress,
    confidence: options.confidence ?? 3,
    difficulty: options.difficulty ?? 'medium',
    lastStudiedAt:
      options.lastStudiedDaysAgo === undefined ? undefined : addDays(today, -options.lastStudiedDaysAgo),
    nextRevisionAt:
      options.nextRevisionInDays === undefined || options.nextRevisionInDays === null
        ? undefined
        : addDays(today, options.nextRevisionInDays),
    revisionCount: options.revisionCount ?? 0,
    resourceUrl: options.resourceUrl ?? '',
    notes: options.notes ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function task(
  date: ISODate,
  subject: string,
  title: string,
  plannedMinutes: number,
  options: {
    topic?: string;
    status?: StudyTask['status'];
    priority?: StudyTask['priority'];
    actualMinutes?: number;
    notes?: string;
  } = {},
): StudyTask {
  const timestamp = now();
  const status = options.status ?? 'pending';
  return {
    id: uid('tsk'),
    date,
    subject,
    topic: options.topic ?? subject,
    title,
    plannedMinutes,
    actualMinutes: options.actualMinutes ?? (status === 'completed' ? plannedMinutes : 0),
    priority: options.priority ?? 'medium',
    status,
    notes: options.notes ?? '',
    completedAt: status === 'completed' ? timestamp : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function project(
  name: string,
  description: string,
  technologies: string[],
  startDaysAgo: number,
  targetInDays: number,
  status: Project['status'],
  repoUrl: string,
  tasks: [string, boolean][],
): Project {
  const timestamp = now();
  const today = todayISO();
  return {
    id: uid('prj'),
    name,
    description,
    technologies,
    repoUrl,
    startDate: addDays(today, -startDaysAgo),
    targetDate: addDays(today, targetInDays),
    status,
    tasks: tasks.map(([title, done]) => ({ id: uid('ptk'), title, done })),
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function note(
  title: string,
  topicName: string,
  tags: string[],
  content: string,
  options: { pinned?: boolean; archived?: boolean; daysAgo?: number } = {},
): Note {
  const timestamp = now();
  return {
    id: uid('nte'),
    title,
    topic: topicName,
    tags,
    content,
    pinned: options.pinned ?? false,
    archived: options.archived ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function session(date: ISODate, minutes: number, subject: string, topicName: string, mode: StudySession['mode']): StudySession {
  return {
    id: uid('ses'),
    date,
    startedAt: `${date}T19:00:00.000Z`,
    minutes,
    subject,
    topic: topicName,
    notes: '',
    mode,
  };
}

/* ------------------------------- courses ------------------------------ */

function buildCourses(): Course[] {
  return [
    course({
      name: 'TrainWithShubham — Complete DevOps',
      instructor: 'Shubham Londhe',
      platform: 'YouTube',
      url: 'https://www.youtube.com/@TrainWithShubham',
      category: 'DevOps',
      totalModules: 14,
      completedModules: 9,
      status: 'in-progress',
      notes: 'Flagship course. Docker → Kubernetes → CI/CD → Terraform.',
      modules: [
        makeModule('01 · Linux & Shell', [
          makeLesson('Linux file system', 45, 'completed'),
          makeLesson('Permissions & users', 40, 'completed'),
          makeLesson('Shell scripting basics', 60, 'completed'),
        ]),
        makeModule('02 · Git & GitHub', [
          makeLesson('Branching and merging', 50, 'completed'),
          makeLesson('Rebase vs merge', 40, 'completed'),
          makeLesson('Pull request workflow', 35, 'completed'),
        ]),
        makeModule('03 · Docker', [
          makeLesson('Images, containers, volumes', 60, 'completed'),
          makeLesson('Dockerfile best practices', 45, 'completed'),
          makeLesson('Docker networking', 45, 'completed'),
          makeLesson('Docker Compose', 45, 'completed'),
        ]),
        makeModule('04 · Kubernetes', [
          makeLesson('Pods, ReplicaSets, Deployments', 60, 'completed'),
          makeLesson('Services & Ingress', 55, 'in-progress'),
          makeLesson('ConfigMaps & Secrets', 40, 'not-started'),
        ]),
        makeModule('05 · CI/CD', [
          makeLesson('Jenkins pipeline as code', 60, 'in-progress'),
          makeLesson('GitHub Actions workflows', 50, 'not-started'),
        ]),
        makeModule('06 · Terraform', [
          makeLesson('Providers, resources, state', 55, 'not-started'),
          makeLesson('Modules & remote state', 50, 'not-started'),
        ]),
        makeModule('07 · Monitoring', [
          makeLesson('Prometheus metrics', 45, 'not-started'),
          makeLesson('Grafana dashboards', 40, 'not-started'),
        ]),
      ],
    }),
    course({
      name: 'AWS Certified Solutions Architect',
      instructor: 'Stephane Maarek',
      platform: 'Udemy',
      url: '',
      category: 'AWS',
      totalModules: 20,
      completedModules: 11,
      status: 'in-progress',
      notes: 'Targeting SAA-C03. Focus on VPC design and IAM policies.',
      modules: [],
    }),
    course({
      name: 'Kubernetes for Absolute Beginners',
      instructor: 'Mumshad Mannambeth',
      platform: 'KodeKloud',
      url: '',
      category: 'Kubernetes',
      totalModules: 12,
      completedModules: 5,
      status: 'in-progress',
      notes: 'Hands-on labs are the real value here.',
      modules: [],
    }),
    course({
      name: 'Terraform: Infrastructure as Code',
      instructor: 'HashiCorp',
      platform: 'HashiCorp Learn',
      url: 'https://developer.hashicorp.com/terraform/tutorials',
      category: 'Terraform',
      totalModules: 10,
      completedModules: 3,
      status: 'in-progress',
      notes: 'Stuck on remote state with S3 + DynamoDB locking.',
      modules: [],
    }),
    course({
      name: 'Java Programming Masterclass',
      instructor: 'Tim Buchalka',
      platform: 'Udemy',
      url: '',
      category: 'Java',
      totalModules: 25,
      completedModules: 12,
      status: 'in-progress',
      notes: 'Collections and concurrency still weak.',
      modules: [],
    }),
  ];
}

/* -------------------------------- topics ------------------------------ */

function buildTopics(): Topic[] {
  return [
    topic('Linux Administration', 'Linux', 'completed', 88, {
      confidence: 5,
      difficulty: 'easy',
      lastStudiedDaysAgo: 9,
      nextRevisionInDays: 6,
      revisionCount: 2,
      notes: 'Strong. Comfortable with systemd, journalctl and disk management.',
    }),
    topic('Networking Fundamentals', 'Networking', 'practiced', 72, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 16,
      nextRevisionInDays: -2,
      revisionCount: 1,
      notes: 'Subnetting still needs drilling before the AWS exam.',
    }),
    topic('Git & Version Control', 'Git', 'completed', 90, {
      confidence: 5,
      difficulty: 'easy',
      lastStudiedDaysAgo: 4,
      nextRevisionInDays: 10,
      revisionCount: 3,
    }),
    topic('GitHub Workflows', 'GitHub', 'practiced', 82, {
      confidence: 4,
      difficulty: 'easy',
      lastStudiedDaysAgo: 6,
      nextRevisionInDays: 8,
      revisionCount: 1,
    }),
    topic('Docker Fundamentals', 'Docker', 'completed', 85, {
      confidence: 4,
      difficulty: 'easy',
      lastStudiedDaysAgo: 5,
      nextRevisionInDays: 7,
      revisionCount: 2,
    }),
    topic('Docker Compose', 'Docker Compose', 'completed', 80, {
      confidence: 4,
      difficulty: 'medium',
      lastStudiedDaysAgo: 2,
      nextRevisionInDays: 5,
      revisionCount: 1,
    }),
    topic('Docker Swarm', 'Docker Swarm', 'learning', 60, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 21,
      nextRevisionInDays: -5,
      revisionCount: 0,
      notes: 'Deprioritised in favour of Kubernetes.',
    }),
    topic('Kubernetes Core Objects', 'Kubernetes', 'practiced', 55, {
      confidence: 3,
      difficulty: 'hard',
      lastStudiedDaysAgo: 1,
      nextRevisionInDays: 1,
      revisionCount: 2,
    }),
    topic('Kubernetes Service', 'Kubernetes', 'learning', 45, {
      confidence: 2,
      difficulty: 'hard',
      lastStudiedDaysAgo: 1,
      nextRevisionInDays: 0,
      revisionCount: 1,
      notes: 'ClusterIP vs NodePort vs LoadBalancer still confuses me.',
    }),
    topic('Kubernetes Ingress', 'Kubernetes', 'need-revision', 30, {
      confidence: 2,
      difficulty: 'hard',
      lastStudiedDaysAgo: 12,
      nextRevisionInDays: -3,
      revisionCount: 1,
      notes: 'Need to rebuild the ingress-nginx demo from scratch.',
    }),
    topic('Jenkins Pipelines', 'Jenkins', 'practiced', 60, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 8,
      nextRevisionInDays: -1,
      revisionCount: 1,
    }),
    topic('GitHub Actions', 'GitHub Actions', 'learning', 65, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 3,
      nextRevisionInDays: 4,
      revisionCount: 0,
    }),
    topic('CI/CD Concepts', 'CI/CD', 'practiced', 55, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 7,
      nextRevisionInDays: 3,
      revisionCount: 1,
    }),
    topic('Terraform Basics', 'Terraform', 'learning', 40, {
      confidence: 2,
      difficulty: 'medium',
      lastStudiedDaysAgo: 10,
      nextRevisionInDays: -2,
      revisionCount: 0,
    }),
    topic('Terraform State Management', 'Terraform', 'learning', 30, {
      confidence: 1,
      difficulty: 'hard',
      lastStudiedDaysAgo: 14,
      nextRevisionInDays: -6,
      revisionCount: 0,
      notes: 'Weakest area. Remote state + locking is unclear.',
    }),
    topic('Ansible Playbooks', 'Ansible', 'learning', 45, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 18,
      nextRevisionInDays: 2,
      revisionCount: 0,
    }),
    topic('AWS EC2 & Auto Scaling', 'AWS', 'practiced', 78, {
      confidence: 4,
      difficulty: 'medium',
      lastStudiedDaysAgo: 5,
      nextRevisionInDays: 6,
      revisionCount: 2,
    }),
    topic('AWS S3 & Storage', 'AWS', 'practiced', 72, {
      confidence: 4,
      difficulty: 'easy',
      lastStudiedDaysAgo: 6,
      nextRevisionInDays: 7,
      revisionCount: 1,
    }),
    topic('AWS IAM', 'AWS', 'learning', 66, {
      confidence: 3,
      difficulty: 'hard',
      lastStudiedDaysAgo: 11,
      nextRevisionInDays: 1,
      revisionCount: 1,
    }),
    topic('AWS VPC Networking', 'AWS', 'learning', 55, {
      confidence: 2,
      difficulty: 'hard',
      lastStudiedDaysAgo: 13,
      nextRevisionInDays: -1,
      revisionCount: 0,
    }),
    topic('Monitoring Fundamentals', 'Monitoring', 'not-started', 22, {
      confidence: 2,
      difficulty: 'medium',
      lastStudiedDaysAgo: 25,
      nextRevisionInDays: null,
      revisionCount: 0,
    }),
    topic('Prometheus', 'Prometheus', 'learning', 25, {
      confidence: 2,
      difficulty: 'hard',
      lastStudiedDaysAgo: 20,
      nextRevisionInDays: -4,
      revisionCount: 0,
      notes: 'PromQL is the blocker.',
    }),
    topic('Grafana', 'Grafana', 'not-started', 15, {
      confidence: 1,
      difficulty: 'easy',
      lastStudiedDaysAgo: 27,
      nextRevisionInDays: null,
      revisionCount: 0,
    }),
    topic('Java Core', 'Java', 'practiced', 58, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 2,
      nextRevisionInDays: 3,
      revisionCount: 1,
    }),
    topic('Java Collections', 'Java', 'learning', 48, {
      confidence: 2,
      difficulty: 'medium',
      lastStudiedDaysAgo: 1,
      nextRevisionInDays: 1,
      revisionCount: 1,
      notes: 'HashMap internals come up in every interview.',
    }),
    topic('Spring Boot', 'Spring Boot', 'learning', 48, {
      confidence: 3,
      difficulty: 'hard',
      lastStudiedDaysAgo: 9,
      nextRevisionInDays: 5,
      revisionCount: 0,
    }),
    topic('SQL Queries', 'SQL', 'practiced', 52, {
      confidence: 3,
      difficulty: 'medium',
      lastStudiedDaysAgo: 12,
      nextRevisionInDays: 2,
      revisionCount: 1,
    }),
    topic('Python Scripting', 'Python', 'learning', 40, {
      confidence: 3,
      difficulty: 'easy',
      lastStudiedDaysAgo: 15,
      nextRevisionInDays: 4,
      revisionCount: 0,
    }),
  ];
}

/* -------------------------------- tasks ------------------------------- */

function buildTasks(): StudyTask[] {
  const today = todayISO();
  const tasks: StudyTask[] = [
    // Today — matches the planner example in the brief.
    task(today, 'DevOps', 'Docker networking deep dive', 45, {
      topic: 'Docker Fundamentals',
      status: 'completed',
      priority: 'high',
      actualMinutes: 45,
      notes: 'Bridge vs host vs overlay. Drew the packet flow on paper.',
    }),
    task(today, 'DevOps', 'Docker Compose multi-service demo', 45, {
      topic: 'Docker Compose',
      status: 'completed',
      priority: 'medium',
      actualMinutes: 45,
      notes: 'compose up with nginx + node + postgres.',
    }),
    task(today, 'DevOps', 'Kubernetes Service types', 30, {
      topic: 'Kubernetes Service',
      priority: 'high',
      status: 'pending',
      notes: 'ClusterIP → NodePort → LoadBalancer, then write the note.',
    }),
    task(today, 'Java', 'Collections: HashMap internals', 60, {
      topic: 'Java Collections',
      priority: 'high',
      status: 'pending',
    }),
    task(today, 'Java', 'DSA: arrays & two pointers', 60, {
      topic: 'DSA',
      priority: 'medium',
      status: 'pending',
    }),

    // Tomorrow
    task(addDays(today, 1), 'DevOps', 'Kubernetes Ingress + TLS', 60, {
      topic: 'Kubernetes Ingress',
      priority: 'critical',
      notes: 'Rebuild the ingress-nginx demo — this is flagged for revision.',
    }),
    task(addDays(today, 1), 'DevOps', 'Terraform remote state with S3', 60, {
      topic: 'Terraform State Management',
      priority: 'high',
    }),
    task(addDays(today, 1), 'Java', 'Spring Boot REST controller', 60, { topic: 'Spring Boot' }),

    // Day after tomorrow
    task(addDays(today, 2), 'DevOps', 'Prometheus scraping + PromQL basics', 60, {
      topic: 'Prometheus',
      priority: 'high',
      status: 'in-progress',
      notes: 'Half way through the metric types.',
    }),
    task(addDays(today, 2), 'DevOps', 'GitHub Actions: build & deploy workflow', 45, {
      topic: 'GitHub Actions',
    }),
    task(addDays(today, 2), 'Java', 'DSA: strings & sliding window', 45, { topic: 'DSA' }),

    // Yesterday
    task(addDays(today, -1), 'DevOps', 'Kubernetes Deployments & rollout', 60, {
      topic: 'Kubernetes Core Objects',
      status: 'completed',
      priority: 'high',
      actualMinutes: 75,
    }),
    task(addDays(today, -1), 'Java', 'Collections: ArrayList vs LinkedList', 45, {
      topic: 'Java Collections',
      status: 'completed',
      actualMinutes: 40,
    }),
    task(addDays(today, -1), 'DevOps', 'Review AWS IAM policies', 30, {
      topic: 'AWS IAM',
      status: 'skipped',
      notes: 'Ran out of evening — moved to tomorrow.',
    }),

    // Earlier in the week
    task(addDays(today, -2), 'DevOps', 'Terraform providers & variables', 60, {
      topic: 'Terraform Basics',
      status: 'completed',
      actualMinutes: 55,
    }),
    task(addDays(today, -2), 'Java', 'Spring Boot dependency injection', 45, {
      topic: 'Spring Boot',
      status: 'completed',
      actualMinutes: 45,
    }),
    task(addDays(today, -3), 'DevOps', 'GitHub Actions workflow syntax', 50, {
      topic: 'GitHub Actions',
      status: 'completed',
      actualMinutes: 50,
    }),
    task(addDays(today, -4), 'DevOps', 'Docker image size optimisation', 45, {
      topic: 'Docker Fundamentals',
      status: 'completed',
      actualMinutes: 50,
    }),
    task(addDays(today, -5), 'DevOps', 'AWS EC2 + user data scripts', 60, {
      topic: 'AWS EC2 & Auto Scaling',
      status: 'completed',
      actualMinutes: 65,
    }),
    task(addDays(today, -6), 'Java', 'Java streams & lambdas', 45, {
      topic: 'Java Core',
      status: 'completed',
      actualMinutes: 45,
    }),
  ];

  return tasks;
}

/* ------------------------------ projects ------------------------------ */

function buildProjects(): Project[] {
  return [
    project(
      'Terraform AWS Infrastructure',
      'Reusable Terraform modules that provision a VPC, an EC2 autoscaling group and an S3 backend for remote state.',
      ['Terraform', 'AWS', 'HCL', 'GitHub Actions'],
      24,
      12,
      'in-progress',
      'https://github.com/example/terraform-aws-infra',
      [
        ['VPC module', true],
        ['EC2 + ASG module', true],
        ['S3 remote state + DynamoDB lock', false],
        ['GitHub Actions plan/apply pipeline', false],
      ],
    ),
    project(
      'Docker Compose Application',
      'Three-tier demo app (nginx → Node API → Postgres) fully containerised with health checks and a Makefile.',
      ['Docker', 'Docker Compose', 'Node.js', 'PostgreSQL'],
      30,
      4,
      'in-progress',
      'https://github.com/example/compose-three-tier',
      [
        ['nginx reverse proxy', true],
        ['Node API service', true],
        ['Postgres + volumes', true],
        ['Health checks & depends_on', false],
        ['README with architecture diagram', false],
      ],
    ),
    project(
      'Kubernetes Deployment',
      'Deploy the three-tier app to a local kind cluster with Helm charts, HPA and an Ingress with TLS.',
      ['Kubernetes', 'Helm', 'Ingress', 'kind'],
      18,
      9,
      'in-progress',
      'https://github.com/example/k8s-three-tier',
      [
        ['Namespace + manifests', true],
        ['ConfigMaps & Secrets', true],
        ['Ingress with TLS', true],
        ['Helm chart packaging', false],
        ['HorizontalPodAutoscaler', false],
      ],
    ),
    project(
      'AI Kubernetes Incident Response',
      'An operator that watches cluster events, correlates them with Prometheus metrics and asks an LLM for a root-cause hypothesis and runbook suggestion.',
      ['Kubernetes', 'Docker', 'GitHub Actions', 'Prometheus', 'Grafana', 'Loki', 'FastAPI', 'Python'],
      12,
      30,
      'in-progress',
      'https://github.com/example/ai-k8s-incident-response',
      [
        ['Dockerise the FastAPI service', true],
        ['Kubernetes event watcher', true],
        ['GitHub Actions CI/CD', true],
        ['Prometheus metric correlation', true],
        ['Grafana dashboard for incidents', false],
        ['Loki log aggregation', false],
        ['FastAPI endpoints + OpenAPI docs', false],
        ['LLM root-cause integration', false],
      ],
    ),
  ];
}

/* -------------------------------- notes ------------------------------- */

function buildNotes(): Note[] {
  return [
    note(
      'Kubernetes Service — complete reference',
      'Kubernetes Service',
      ['kubernetes', 'networking', 'service', 'interview'],
      `## Definition

A **Service** is a stable virtual IP + DNS name in front of a set of Pods selected by labels.

## Commands

\`\`\`bash
kubectl expose deploy web --port 80 --target-port 8080 --type NodePort
kubectl get svc -o wide
kubectl describe svc web
kubectl get endpoints web
\`\`\`

## Service types

1. **ClusterIP** — internal only (default)
2. **NodePort** — opens 30000-32767 on every node
3. **LoadBalancer** — provisions a cloud LB
4. **ExternalName** — CNAME to an external host

## Common mistakes

- Selector typo → empty Endpoints list, traffic blackholes.
- Creating a LoadBalancer in a lab cluster and waiting forever for an external IP.
- Forgetting \`targetPort\` when the container listens on a different port.
- Expecting NodePort ranges to be configurable per service (they are cluster-wide).

## Interview questions

- ClusterIP vs NodePort vs LoadBalancer — when do you use each?
- How does kube-proxy implement a ClusterIP in iptables/IPVS mode?
- What is a headless service and why would you want one?

## My notes

I keep confusing \`port\` and \`targetPort\`. port = what the Service listens on, targetPort = what the container listens on.`,
      { pinned: true },
    ),
    note(
      'Docker networking cheat sheet',
      'Docker Fundamentals',
      ['docker', 'networking', 'cheatsheet'],
      `## Drivers

| Driver | Use case |
| --- | --- |
| bridge | default, single-host containers |
| host | no isolation, fastest |
| overlay | multi-host / Swarm |
| macvlan | containers need real MAC addresses |
| none | fully isolated |

## Useful commands

\`\`\`bash
docker network ls
docker network inspect bridge
docker network create --driver bridge my-net
docker run --network my-net --name api nginx
docker exec -it api sh -c "ping db"
\`\`\`

> Containers on a **user-defined bridge** get automatic DNS resolution by name. The default \`bridge\` network does not.

## Common mistakes

- Using the default bridge and wondering why container names do not resolve.
- Publishing the same host port for two replicas.
- Assuming \`localhost\` inside a container reaches the host (it does not — use \`host.docker.internal\`).`,
      { pinned: true },
    ),
    note(
      'Terraform state — what I need to re-learn',
      'Terraform State Management',
      ['terraform', 'state', 'revision'],
      `## Why state matters

Terraform compares desired config against **state**, not the real world.

## Remote backend

\`\`\`hcl
terraform {
  backend "s3" {
    bucket         = "my-tf-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "tf-lock"
    encrypt        = true
  }
}
\`\`\`

## Open questions for revision

- What exactly does \`terraform state mv\` do versus \`import\`?
- How does \`terraform refresh\` differ from \`plan -refresh-only\`?
- When is a lock released if a run crashes?
- Why is committing \`.tfstate\` to git dangerous? (Secrets land in plain text.)`,
    ),
    note(
      'Jenkins declarative pipeline template',
      'Jenkins Pipelines',
      ['jenkins', 'ci-cd', 'template'],
      `\`\`\`groovy
pipeline {
  agent any
  environment { REGISTRY = 'ghcr.io/example' }
  stages {
    stage('Build') { steps { sh 'docker build -t $REGISTRY/app:$BUILD_NUMBER .' } }
    stage('Test')  { steps { sh 'npm test' } }
    stage('Push')  { steps { sh 'docker push $REGISTRY/app:$BUILD_NUMBER' } }
  }
  post {
    failure { slackSend channel: '#builds', message: "Failed: \${env.BUILD_URL}" }
    always  { cleanWs() }
  }
}
\`\`\`

Remember: \`agent\` must be declared per stage when you need different executors (e.g. Docker-in-Docker).`,
    ),
    note(
      'AWS VPC design — interview answer skeleton',
      'AWS VPC Networking',
      ['aws', 'vpc', 'interview', 'networking'],
      `**Blast radius first.** Each environment gets its own account/VPC; each tier its own subnet.

- /16 VPC, /24 subnets. Two AZs minimum, three for production.
- Public subnets only for ALB + NAT Gateway.
- Private subnets for app + data tiers. No route to the internet gateway.
- NAT Gateway *per AZ* to avoid cross-AZ data charges.
- VPC endpoints (gateway for S3/DynamoDB) to keep traffic off the NAT.
- Security groups are stateful; NACLs are stateless and evaluated per subnet.

Questions I still fumble: NACL ephemeral port ranges, and how a bastion vs SSM Session Manager changes the design.`,
      { daysAgo: 4 },
    ),
    note(
      'Java Collections — HashMap internals',
      'Java Collections',
      ['java', 'collections', 'interview'],
      `## HashMap

- Array of buckets; \`hash(key) ^ (h >>> 16)\` spreads bits.
- Default capacity 16, load factor 0.75 → resize to double at 12 entries.
- **Java 8+**: a bucket converts to a red-black tree once it holds 8 entries *and* capacity ≥ 64.
- \`equals\` and \`hashCode\` must agree, or you get lost entries.

## Ordered alternatives

- \`LinkedHashMap\` — insertion (or access) order.
- \`TreeMap\` — sorted, O(log n), needs Comparable/Comparator.
- \`ConcurrentHashMap\` — CAS + synchronized bins, no null keys/values.

Open question: why is the treeify threshold 8 and untreeify 6? (Hysteresis to avoid thrashing.)`,
      { daysAgo: 2 },
    ),
    note(
      'Old draft: Docker Swarm notes',
      'Docker Swarm',
      ['docker', 'swarm', 'archive'],
      `Superseded by Kubernetes notes. Keeping only the \`docker service\` commands for reference.

\`\`\`bash
docker swarm init
docker service create --replicas 3 --name web nginx
docker service ls
\`\`\``,
      { archived: true, daysAgo: 20 },
    ),
  ];
}

/* ---------------------------- study sessions -------------------------- */

function buildSessions(): StudySession[] {
  const today = todayISO();
  // Gaps chosen so the sample profile shows: current streak 12, longest 18.
  const skipDays = new Set([12, 31, 49]);
  const sessions: StudySession[] = [];

  const rotations: { subject: string; topic: string; minutes: number }[] = [
    { subject: 'DevOps', topic: 'Kubernetes Core Objects', minutes: 75 },
    { subject: 'Java', topic: 'Java Collections', minutes: 50 },
    { subject: 'DevOps', topic: 'Docker Fundamentals', minutes: 60 },
    { subject: 'DevOps', topic: 'Terraform Basics', minutes: 70 },
    { subject: 'Java', topic: 'Spring Boot', minutes: 45 },
    { subject: 'DevOps', topic: 'GitHub Actions', minutes: 65 },
    { subject: 'DevOps', topic: 'AWS VPC Networking', minutes: 80 },
    { subject: 'DevOps', topic: 'Prometheus', minutes: 40 },
    { subject: 'Java', topic: 'Java Core', minutes: 55 },
    { subject: 'DevOps', topic: 'Jenkins Pipelines', minutes: 60 },
    { subject: 'DevOps', topic: 'Kubernetes Ingress', minutes: 90 },
    { subject: 'DevOps', topic: 'Ansible Playbooks', minutes: 45 },
  ];

  for (let offset = 0; offset < 60; offset += 1) {
    if (skipDays.has(offset)) continue;
    const entry = rotations[offset % rotations.length];
    const isToday = offset === 0;
    sessions.push(
      session(
        addDays(today, -offset),
        isToday ? 90 : Math.max(30, entry.minutes + ((offset * 7) % 25) - 12),
        entry.subject,
        entry.topic,
        isToday ? 'pomodoro-25' : offset % 3 === 0 ? 'pomodoro-50' : 'pomodoro-25',
      ),
    );
  }

  return sessions;
}

/* -------------------------------- revisions --------------------------- */

function buildRevisions(): RevisionRecord[] {
  const today = todayISO();
  const entries: [string, number, number, number][] = [
    ['Linux Administration', 12, 5, 30],
    ['Git & Version Control', 9, 5, 20],
    ['Docker Fundamentals', 8, 4, 35],
    ['Kubernetes Core Objects', 5, 3, 45],
    ['AWS EC2 & Auto Scaling', 4, 4, 40],
    ['Kubernetes Service', 2, 2, 30],
    ['Java Collections', 1, 2, 25],
    ['SQL Queries', 3, 3, 20],
  ];

  return entries.map(([topicName, daysAgo, confidence, minutes]) => ({
    id: uid('rev'),
    topicId: null,
    topicName,
    date: addDays(today, -daysAgo),
    confidence: confidence as RevisionRecord['confidence'],
    minutes,
    notes: '',
  }));
}

export function createSampleData(): SampleData {
  return {
    courses: buildCourses(),
    topics: buildTopics(),
    tasks: buildTasks(),
    projects: buildProjects(),
    notes: buildNotes(),
    sessions: buildSessions(),
    revisions: buildRevisions(),
  };
}

/** Counters shown on the "load sample data" confirmation dialog. */
export function describeSampleData(data: SampleData): string {
  return [
    `${data.courses.length} courses`,
    `${data.topics.length} topics`,
    `${data.tasks.length} tasks`,
    `${data.projects.length} projects`,
    `${data.notes.length} notes`,
    `${data.sessions.length} study sessions`,
  ].join(' · ');
}
