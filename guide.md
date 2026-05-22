# SkuliNode — GitHub Copilot Implementation Prompt

> Feed this entire document to Copilot as your working brief.
> Work through it section by section — do NOT try to generate everything at once.

---

## 0. PROJECT OVERVIEW

Build **SkuliNode**, a multi-school SaaS platform for Tanzanian schools that digitizes
the internal exam cycle: mark entry → mkeka generation → results publishing → parent SMS.

**Stack:**
- Backend: Django 4.2 + Django REST Framework (DRF)
- Frontend: React 18 + Vite + Tailwind CSS v3
- Database: PostgreSQL
- Auth: JWT (via `djangorestframework-simplejwt`)
- SMS: Africa's Talking API (Tanzanian SMS gateway)
- PDF generation: WeasyPrint (server-side mkeka PDF)
- Task queue: Celery + Redis (for SMS dispatch)

---

## 1. ROLES & PERMISSIONS

There are 4 user roles. Each school is an isolated tenant.

| Role | Scope | Can Do |
|---|---|---|
| `super_admin` | Platform-wide | Manage schools, plans, billing |
| `head_teacher` | One school | Manage teachers, classes, subjects, view all results |
| `teacher` | One school | Enter marks for assigned subjects/classes only |
| `academic_officer` | One school | View all submitted mkekas, approve results, publish |

**Rules:**
- A teacher can only see and edit marks for their own assigned classes/subjects
- An academic officer cannot enter marks
- Head teacher can do everything within their school
- No cross-school data leakage — all querysets must filter by `school`

---

## 2. DATABASE MODELS

### `schools/models.py`

```python
class Plan(models.Model):
    name = models.CharField(max_length=50)          # Basic, Standard, Pro
    price_per_student = models.IntegerField()        # TZS: 200, 500, 1000
    has_sms = models.BooleanField(default=False)
    has_analytics = models.BooleanField(default=False)
    has_publishing = models.BooleanField(default=False)
    has_trends = models.BooleanField(default=False)
    has_multichain = models.BooleanField(default=False)

class School(models.Model):
    name = models.CharField(max_length=200)
    registration_number = models.CharField(max_length=100, unique=True)
    region = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    logo = models.ImageField(upload_to='school_logos/', null=True, blank=True)
```

### `accounts/models.py`

```python
class User(AbstractUser):
    ROLES = [('super_admin','Super Admin'),('head_teacher','Head Teacher'),
             ('teacher','Teacher'),('academic_officer','Academic Officer')]
    role = models.CharField(max_length=30, choices=ROLES)
    school = models.ForeignKey('schools.School', null=True, blank=True,
                               on_delete=models.CASCADE, related_name='users')
    phone = models.CharField(max_length=20, blank=True)
```

### `academics/models.py`

```python
class AcademicYear(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    year = models.IntegerField()                    # e.g. 2025

class Term(models.Model):
    TERM_CHOICES = [('1', 'Term 1'), ('2', 'Term 2')]
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE)
    term_number = models.CharField(max_length=1, choices=TERM_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=False)  # only one active term per school

class Class(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=50)          # e.g. Form 1A, Standard 4B
    level = models.IntegerField()                   # 1–7 primary, 1–6 secondary
    stream = models.CharField(max_length=10, blank=True)  # A, B, C

class Subject(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    is_core = models.BooleanField(default=True)

class Student(models.Model):
    GENDER = [('M','Male'),('F','Female')]
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE,
                                      related_name='students')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    admission_number = models.CharField(max_length=50)
    gender = models.CharField(max_length=1, choices=GENDER)
    parent_phone = models.CharField(max_length=20, blank=True)

class TeacherAssignment(models.Model):
    """Links a teacher to a subject + class"""
    teacher = models.ForeignKey(User, on_delete=models.CASCADE,
                                related_name='assignments')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    term = models.ForeignKey(Term, on_delete=models.CASCADE)

class Mark(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE,
                                related_name='marks')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    term = models.ForeignKey(Term, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    score = models.DecimalField(max_digits=5, decimal_places=2)
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_submitted = models.BooleanField(default=False)  # locked after submission

    class Meta:
        unique_together = ('student', 'subject', 'term')

class Mkeka(models.Model):
    """Generated report sheet per subject per class per term"""
    STATUS = [('draft','Draft'),('submitted','Submitted'),('approved','Approved')]
    student_class = models.ForeignKey(Class, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    term = models.ForeignKey(Term, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, choices=STATUS, default='draft')
    pdf_file = models.FileField(upload_to='mkekas/', null=True, blank=True)
    generated_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL,
                                    null=True, related_name='approved_mkekas')

class ResultPublication(models.Model):
    """When academic officer publishes results for a term"""
    term = models.ForeignKey(Term, on_delete=models.CASCADE)
    school = models.ForeignKey(School, on_delete=models.CASCADE)
    published_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    published_at = models.DateTimeField(auto_now_add=True)
    sms_sent = models.BooleanField(default=False)
    sms_count = models.IntegerField(default=0)

class Notification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE,
                             related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    link = models.CharField(max_length=200, blank=True)
```

---

## 3. GRADING SYSTEM

Tanzania NECTA grading — implement as a utility in `academics/grading.py`:

```python
GRADE_BOUNDARIES = [
    (75, 100, 'A'),
    (65, 74,  'B'),
    (50, 64,  'C'),
    (30, 49,  'D'),
    (0,  29,  'F'),
]

GPA_MAP = {'A': 1, 'B': 2, 'C': 3, 'D': 4, 'F': 5}
# Lower GPA = better (NECTA convention)

DIVISION_MAP = {
    (1.0, 2.0): 'Division I',
    (2.1, 3.0): 'Division II',
    (3.1, 3.5): 'Division III',
    (3.6, 4.0): 'Division IV',
    (4.1, 5.0): 'Fail',
}

def get_grade(score: float) -> str: ...
def get_gpa(grade: str) -> int: ...
def get_division(avg_gpa: float) -> str: ...
def compute_class_stats(marks_queryset) -> dict:
    """
    Returns:
    {
      total_students: int,
      boys: int, girls: int,
      grade_dist: { 'A': {total, boys, girls}, 'B': {...}, ... },
      subject_gpa: float,
      mean_grade: str,
      pass_rate: float,
      division_summary: { 'Division I': int, ... }
    }
    """
```

---

## 4. API ENDPOINTS (DRF)

### Auth
```
POST   /api/auth/login/          → JWT login, return access + refresh + user role
POST   /api/auth/refresh/        → refresh token
POST   /api/auth/logout/         → blacklist token
GET    /api/auth/me/             → current user profile
```

### Schools (super_admin only)
```
GET/POST        /api/schools/
GET/PUT/DELETE  /api/schools/{id}/
POST            /api/schools/{id}/activate/
POST            /api/schools/{id}/deactivate/
```

### Users (head_teacher manages within school)
```
GET/POST        /api/users/
GET/PUT/DELETE  /api/users/{id}/
POST            /api/users/{id}/reset-password/
```

### Academics
```
GET/POST        /api/classes/
GET/POST        /api/subjects/
GET/POST        /api/students/            ← bulk import via CSV supported
GET/POST        /api/terms/
GET/POST        /api/assignments/         ← assign teacher to subject+class
```

### Marks (teacher)
```
GET    /api/marks/?class={id}&subject={id}&term={id}    ← prefilled student list
POST   /api/marks/bulk/                                  ← save multiple marks at once
POST   /api/marks/submit/?class={id}&subject={id}&term={id}  ← lock & generate mkeka
```

### Mkeka
```
GET    /api/mkekas/                       ← teacher sees own; academic sees all
GET    /api/mkekas/{id}/
GET    /api/mkekas/{id}/preview/          ← returns computed stats JSON
GET    /api/mkekas/{id}/pdf/              ← generate & return PDF
POST   /api/mkekas/{id}/submit/           ← teacher submits to academic
POST   /api/mkekas/{id}/approve/          ← academic officer approves
```

### Results & Publishing
```
GET    /api/results/student/{student_id}/?term={id}     ← full student result card
GET    /api/results/class/{class_id}/?term={id}         ← class overview
GET    /api/results/school/?term={id}                   ← school-wide analytics (Pro)
POST   /api/results/publish/?term={id}                  ← academic publishes results
```

### Notifications
```
GET    /api/notifications/
POST   /api/notifications/mark-read/
```

---

## 5. MKEKA PDF STRUCTURE

Generate using WeasyPrint from an HTML template at
`academics/templates/mkeka_pdf.html`.

The mkeka must contain:

1. **Header block**
   - School name, logo, region/district
   - Academic year, term number
   - Class name, subject name, teacher name
   - Date generated

2. **Summary row**
   - Total enrolled | Total sat | Absentees

3. **Grade Distribution Table**

| Grade | Boys | Girls | Total | % |
|---|---|---|---|---|
| A (75–100) | | | | |
| B (65–74) | | | | |
| C (50–64) | | | | |
| D (30–49) | | | | |
| F (0–29) | | | | |
| **Total** | | | | |

4. **Subject GPA** and **Mean Grade**
5. **Pass Rate** (% scoring ≥ 30)
6. **Division Summary** (Div I / II / III / IV / Fail counts)
7. **Signature block** — Teacher signature & date | Head Teacher signature & date
8. **Footer** — "Generated by SkuliNode | skulinode.co.tz"

---

## 6. SMS DISPATCH (Celery Task)

On `ResultPublication` creation, if school plan has `has_sms=True`:

```python
# academics/tasks.py
@shared_task
def send_result_sms(publication_id):
    """
    For each student in the school for this term:
    - Get all their marks
    - Compute their GPA and division
    - Send SMS to parent_phone:
      "Matokeo ya [Student Name] - [School Name]
       Muhula [Term]: GPA [X.X], [Division].
       Maelezo zaidi: skulinode.co.tz
       -SkuliNode"
    """
```

Use Africa's Talking SDK. Store API key per school or globally in settings.
Log each SMS sent. Update `ResultPublication.sms_count`.

---

## 7. REACT FRONTEND STRUCTURE

```
src/
  api/           ← axios instance with JWT interceptors + auto-refresh
  components/
    ui/           ← Button, Input, Modal, Table, Badge, Spinner, Toast
    layout/       ← Sidebar, Topbar, PageHeader
  pages/
    auth/         ← Login.jsx
    dashboard/    ← Dashboard.jsx (role-aware)
    marks/        ← MarkEntry.jsx, MarksList.jsx
    mkekas/       ← MkekaList.jsx, MkekaDetail.jsx, MkekaPreview.jsx
    results/      ← StudentResult.jsx, ClassOverview.jsx, SchoolAnalytics.jsx
    students/     ← StudentList.jsx, StudentImport.jsx
    users/        ← UserList.jsx, UserForm.jsx
    schools/      ← SchoolList.jsx (super_admin only)
    notifications/ ← NotificationPanel.jsx
  hooks/
    useAuth.js
    useRole.js    ← returns current role, hasPermission(action)
    useNotifications.js
  store/          ← Zustand store for auth state
  router/         ← React Router v6, role-based route guards
```

---

## 8. KEY UI PAGES — DETAILED SPEC

### 8.1 Login Page
- School name/logo at top
- Email + password fields
- JWT stored in memory (access) + httpOnly cookie (refresh)
- On login, redirect based on role:
  - `teacher` → `/marks`
  - `academic_officer` → `/mkekas`
  - `head_teacher` → `/dashboard`
  - `super_admin` → `/schools`

### 8.2 Mark Entry Page (`/marks/enter`)
- Teacher selects: Class → Subject → Term (only their assignments shown)
- Table renders one row per student (sorted: boys first, then girls, alphabetical)
- Each row: Admission No | Student Name | Gender | Score input (0–100) | Grade (auto-computed live)
- Grade badge updates color in real time as score is typed:
  - A = green, B = teal, C = yellow, D = orange, F = red
- Bottom bar shows live stats: class average, grade distribution preview
- "Save Draft" button — saves without locking
- "Submit & Generate Mkeka" button — locks marks, triggers mkeka generation API

### 8.3 Mkeka Preview Page (`/mkekas/{id}/preview`)
- Shows the computed stats in a clean on-screen layout matching the PDF
- "Download PDF" button → calls `/api/mkekas/{id}/pdf/`
- "Submit to Academic" button (teacher) → calls submit endpoint
- Status badge: Draft | Submitted | Approved

### 8.4 Academic Officer Dashboard (`/mkekas`)
- List of all mkekas grouped by class
- Filter by: Class | Subject | Status
- Each row: Class | Subject | Teacher | Status | Submitted date | Actions
- "Approve" button per mkeka
- "Publish Results" button (appears when ALL mkekas for term are approved)
  - Confirmation modal: "This will notify X parents via SMS. Confirm?"

### 8.5 Class Overview (`/results/class/{id}`)
- Term selector at top
- Subject-wise performance table:
  | Subject | Mean Grade | GPA | Pass % | Boys Avg | Girls Avg |
- Bar chart: grade distribution across subjects
- Top 10 students by GPA (sortable)
- Export class report as PDF

### 8.6 Student Result Card (`/results/student/{id}`)
- Student details header: name, admission no, class, term
- Subject results table: Subject | Score | Grade | GPA
- Overall: Total GPA average | Division | Position in class
- Printable layout

### 8.7 Notifications Panel (slide-out drawer)
- Bell icon in topbar with unread count badge
- List of notifications with timestamp and link
- "Mark all read" button

---

## 9. TAILWIND DESIGN SYSTEM

Use these as CSS variables in `tailwind.config.js` and `index.css`:

```js
colors: {
  primary: {
    50:  '#EAF3FB',
    100: '#C5DFF5',
    500: '#2196F3',
    700: '#1A3C6B',
    900: '#0D1F3C',
  },
  grade: {
    a: '#16a34a',   // green-600
    b: '#0d9488',   // teal-600
    c: '#ca8a04',   // yellow-600
    d: '#ea580c',   // orange-600
    f: '#dc2626',   // red-600
  }
}
```

Typography: Use `DM Sans` for UI, `DM Mono` for scores/numbers.
Add to `index.html`: Google Fonts import for both.

Sidebar: fixed left, 240px wide, dark (`primary-900`), white text.
Topbar: white, shadow-sm, school name + notifications + user avatar.
Cards: white, rounded-xl, shadow-sm, p-6.
Tables: striped rows, sticky header, hover highlight.

---

## 10. PERMISSIONS MATRIX (implement as DRF permission classes)

| Action | super_admin | head_teacher | academic_officer | teacher |
|---|---|---|---|---|
| Manage schools | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ✅ | ❌ | ❌ |
| Manage students | ✅ | ✅ | ❌ | ❌ |
| Enter marks | ❌ | ✅ | ❌ | ✅ (own only) |
| View all mkekas | ✅ | ✅ | ✅ | ❌ (own only) |
| Approve mkeka | ❌ | ✅ | ✅ | ❌ |
| Publish results | ❌ | ✅ | ✅ | ❌ |
| View class analytics | ✅ | ✅ | ✅ | ✅ (own class) |
| View school analytics | ✅ | ✅ | ✅ | ❌ |
| Send SMS | auto on publish | auto on publish | triggers | ❌ |

---

## 11. IMPLEMENTATION ORDER (feed to Copilot one section at a time)

1. Django project setup — apps, settings, CORS, JWT, PostgreSQL
2. All models + migrations
3. `grading.py` utility functions + unit tests
4. Auth endpoints + JWT middleware
5. School & User CRUD endpoints
6. Academic models endpoints (classes, subjects, students, terms, assignments)
7. Mark entry endpoints (bulk save + submit)
8. Mkeka stats computation + PDF generation (WeasyPrint)
9. Results endpoints (student card, class overview, school analytics)
10. Result publication + Celery SMS task
11. Notification system
12. React project setup (Vite + Tailwind + Router + Zustand + Axios)
13. Auth flow (login page, JWT interceptors, route guards)
14. Layout (Sidebar + Topbar + notification drawer)
15. Mark entry page (live grade computation)
16. Mkeka preview + PDF download
17. Academic officer dashboard
18. Class overview + charts (use Recharts)
19. Student result card
20. Super admin school management

---

## 12. ENVIRONMENT VARIABLES

```env
# Django
SECRET_KEY=
DEBUG=True
DATABASE_URL=postgres://...
REDIS_URL=redis://localhost:6379/0
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
AFRICASTALKING_SENDER_ID=SkuliNode

# React
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 13. NOTES FOR COPILOT

- All Django querysets must filter by `request.user.school` — never expose cross-school data
- Marks are locked (`is_submitted=True`) once submitted — no edits allowed after
- PDF generation is synchronous for now (move to Celery task later if slow)
- The mkeka PDF must be print-ready A4, portrait
- Use `django-filter` for all list endpoint filtering
- Paginate all list endpoints (default page size 50)
- Return consistent error format: `{"error": "message", "code": "ERROR_CODE"}`
- React: all API calls go through `src/api/index.js` — no direct fetch() calls in components
- Use React Query (`@tanstack/react-query`) for server state management
- Protect all routes with `<PrivateRoute role={['teacher']} />` wrapper component
```