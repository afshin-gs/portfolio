/**
 * Structured resume data for /resume.
 *
 * This is the WEB summary. The authoritative document is cv/main.tex, which
 * builds to /cv.pdf. Nothing here is generated from that file, so when a fact
 * changes in the CV it has to be changed here too.
 *
 * Deliberately shorter than the PDF: no per-course grade table, no bullet lists
 * per project. A visitor who wants that detail downloads the PDF.
 *
 * House rule inherited from the CV: no em-dashes in reader-facing prose.
 */

export interface TimelineEntry {
  /**
   * Free-text period, e.g. '2022 – Present' or a single year. Optional: the
   * project entries genuinely have no dates on record, and a fabricated one is
   * worse than an absent one.
   */
  period?: string
  title: string
  /** Employer, institution, venue, or the toolchain a project was built in. */
  org?: string
  /** One or two sentences. Omit for entries that need no elaboration. */
  detail?: string
}

export interface ResumeSection {
  /** Used as the column heading and as the section's anchor id. */
  id: string
  heading: string
  entries: readonly TimelineEntry[]
}

export const resumeSections: readonly ResumeSection[] = [
  {
    id: 'education',
    heading: 'Education',
    entries: [
      {
        period: 'Fall 2023 – Summer 2027 (expected)',
        title: 'B.Sc. Chemical Engineering',
        org: 'Shiraz University, Shiraz',
        detail:
          'Cumulative GPA 17.93 / 20.00; last two years 18.52 / 20.00 (estimated). Ranked 3rd in class to date, consistently among the top three of the cohort by semester. Perfect 20.00 in six core courses: Mass Transfer, Unit Operations I, the heat transfer and fluid mechanics laboratories, Numerical Methods, and Introduction to Biological Sciences.',
      },
    ],
  },
  {
    id: 'research',
    heading: 'Research & Laboratory',
    entries: [
      {
        period: 'Summer 2026 – present',
        title: 'Biochemistry Laboratory Intern',
        org: 'Sturgeon Research Facility, Rasht',
        detail:
          'Catalase activity and malondialdehyde (MDA) assays on tissue samples: homogenisation, micropipetting, buffer and standard preparation, centrifugation, and quantification by spectrophotometry against experimentally generated standard curves.',
      },
    ],
  },
  {
    id: 'projects',
    heading: 'Selected Projects',
    entries: [
      {
        title: 'Computational McCabe–Thiele Simulator',
        org: 'MATLAB, JavaScript',
        detail:
          'Multi-section distillation with arbitrary feeds, side streams, and subcooled reflux. Operating lines, q-lines, VLE interpolation, Murphree efficiency, and automated stage stepping, ported to a browser implementation.',
      },
      {
        title: 'Coupled Transport Modelling of Evaporative Cooling',
        org: 'COMSOL Multiphysics',
        detail:
          'Three-dimensional model coupling turbulent airflow, heat transfer, and evaporative mass transfer. Neglecting latent heat shifted the predicted ten-minute liquid temperature by roughly 14 percent.',
      },
      {
        title: 'Nonlinear Material-Balance Modelling of Crystallisation',
        org: 'MATLAB',
        detail:
          'Six-variable nonlinear balance solved symbolically after the Newton formulation failed to converge, then validated by redrawing the control volumes. Graded 20 / 20.',
      },
      {
        title: 'cheme-thermo-solvers, numerical-methods-cheme',
        org: 'MATLAB, open source',
        detail:
          'A phase-equilibrium library (multicomponent VLE, bubble and dew points, UNIFAC activity) and a multi-variable nonlinear regression engine for Arrhenius and growth kinetics.',
      },
    ],
  },
  {
    id: 'teaching',
    heading: 'Teaching & Outreach',
    entries: [
      {
        period: 'Fall 2025',
        title: 'Teaching Assistant, Thermodynamics I',
        org: 'Shiraz University',
        detail:
          'Led problem-solving sessions on assigned homework and examination preparation, working through solution strategy rather than answers.',
      },
      {
        title: 'Volunteer Peer Instructor',
        org: 'Student Learning Centre for Accessible Learning',
        detail:
          'Material balances, thermodynamics, and fluid mechanics for groups of petroleum engineering students.',
      },
      {
        period: 'Summer 2024',
        title: 'Free Discussions in Foreign Languages',
        org: 'Coordinator and session leader',
        detail: 'Twelve free discussion sessions in English and German, open to all participants.',
      },
    ],
  },
  {
    id: 'honours',
    heading: 'Honours & Certifications',
    entries: [
      {
        period: '2023',
        title: 'Top 1% nationally',
        org: 'Iranian National University Entrance Examination (Konkur)',
        detail: 'Of 136,000 participants.',
      },
      {
        period: 'Summer 2021',
        title: 'Qualified past the first round',
        org: 'Iranian National Chemistry Olympiad',
      },
      {
        title: 'Health, Safety and Environment (HSE) Certificate',
        org: 'Shiraz University',
      },
    ],
  },
  {
    id: 'languages',
    heading: 'Languages',
    entries: [
      { title: 'Persian', org: 'Native' },
      { title: 'English', org: 'Advanced / fluent' },
      { title: 'German', org: 'Intermediate (A2–B1)' },
    ],
  },
]
