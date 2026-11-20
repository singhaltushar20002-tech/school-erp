import { OrganizationType } from '~/modules/organizations/enums/organization-type.enum';
import type { CurriculumTemplate } from './curriculum-template';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const PRIMARY = [
  'English',
  'Hindi',
  'Mathematics',
  'Environmental Studies',
  'Computer Studies',
  'Art Education',
  'Physical Education',
];

const MIDDLE = [
  'English',
  'Hindi',
  'Mathematics',
  'Science',
  'Social Science',
  'Computer Studies',
  'Art Education',
  'Physical Education',
];

/**
 * CBSE (NCERT) scheme: primary classes 1–5 with EVS, middle 6–8 with a
 * third language, secondary 9–10 with board subject codes, and senior
 * secondary 11–12 in Science, Commerce and Humanities streams.
 */
export const CBSE_TEMPLATE: CurriculumTemplate = {
  code: 'cbse',
  name: 'CBSE (Class 1–12)',
  description:
    'NCERT subjects for classes 1–8, CBSE board subjects with codes for 9–10, and Science, Commerce and Humanities streams for 11–12.',
  suggestedFor: [OrganizationType.SCHOOL, OrganizationType.ENGLISH_MEDIUM],
  subjects: [
    { name: 'English' },
    { name: 'Hindi' },
    { name: 'Mathematics' },
    { name: 'Environmental Studies' },
    { name: 'Science' },
    { name: 'Social Science' },
    { name: 'Sanskrit' },
    { name: 'Computer Studies' },
    { name: 'Art Education' },
    { name: 'Physical Education' },
    { name: 'English Language and Literature', code: '184' },
    { name: 'Hindi Course A', code: '002' },
    { name: 'Hindi Course B', code: '085' },
    { name: 'Sanskrit (Board)', code: '122' },
    { name: 'Mathematics Standard', code: '041' },
    { name: 'Mathematics Basic', code: '241' },
    { name: 'Science (Board)', code: '086' },
    { name: 'Social Science (Board)', code: '087' },
    { name: 'Information Technology', code: '402' },
    { name: 'English Core', code: '301' },
    { name: 'Physics', code: '042' },
    { name: 'Chemistry', code: '043' },
    { name: 'Biology', code: '044' },
    { name: 'Mathematics (Senior)' },
    { name: 'Computer Science', code: '083' },
    { name: 'Accountancy', code: '055' },
    { name: 'Business Studies', code: '054' },
    { name: 'Economics', code: '030' },
    { name: 'History', code: '027' },
    { name: 'Political Science', code: '028' },
    { name: 'Geography', code: '029' },
    { name: 'Psychology', code: '037' },
    { name: 'Physical Education (Senior)', code: '048' },
  ],
  groups: [
    {
      name: 'Science',
      subjects: [
        { name: 'Physics', compulsory: true },
        { name: 'Chemistry', compulsory: true },
        { name: 'Mathematics (Senior)', compulsory: false },
        { name: 'Biology', compulsory: false },
        { name: 'Computer Science', compulsory: false },
      ],
    },
    {
      name: 'Commerce',
      subjects: [
        { name: 'Accountancy', compulsory: true },
        { name: 'Business Studies', compulsory: true },
        { name: 'Economics', compulsory: true },
        { name: 'Mathematics (Senior)', compulsory: false },
      ],
    },
    {
      name: 'Humanities',
      subjects: [
        { name: 'History', compulsory: true },
        { name: 'Political Science', compulsory: true },
        { name: 'Geography', compulsory: false },
        { name: 'Economics', compulsory: false },
        { name: 'Psychology', compulsory: false },
      ],
    },
  ],
  classes: [
    ...range(1, 5).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: PRIMARY,
    })),
    ...range(6, 8).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: MIDDLE,
      optional: ['Sanskrit'],
    })),
    ...range(9, 10).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: [
        'English Language and Literature',
        'Science (Board)',
        'Social Science (Board)',
        'Information Technology',
      ],
      optional: [
        'Hindi Course A',
        'Hindi Course B',
        'Sanskrit (Board)',
        'Mathematics Standard',
        'Mathematics Basic',
      ],
    })),
    ...range(11, 12).map((n) => ({
      name: `Class ${n}`,
      level: n,
      compulsory: ['English Core'],
      optional: ['Physical Education (Senior)'],
      groups: ['Science', 'Commerce', 'Humanities'],
    })),
  ],
};
