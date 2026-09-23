import {
  activities,
  emptyPlan,
  isFuturePlan,
  type DatePlan,
} from './date-config.ts';
export type Scene =
  | 'BOOT'
  | 'INVITATION'
  | 'YES_PROCESSING'
  | 'CONNECTED'
  | 'CELEBRATION'
  | 'GAME_PROMPT'
  | 'LOVE_SNAKE'
  | 'GAME_COMPLETE'
  | 'ENDING'
  | 'ACTIVITY_PICKER'
  | 'DATE_PICKER'
  | 'PLACE_PICKER'
  | 'MESSAGE_NOTIFICATION'
  | 'MESSAGE'
  | 'DATE_DETAILS';
export const noMessages = [
  'Are you sure?',
  'Really?',
  'Hmm, interesting...',
  'Signal must be lost :)',
  'Try the other button?',
  'My heart says ask again.',
];
export type LoveState = { scene: Scene; noAttempts: number; plan: DatePlan };
export type LoveAction =
  | {
      type:
        | 'BOOT_DONE'
        | 'ACCEPT'
        | 'DECLINE'
        | 'NEXT'
        | 'PLAY'
        | 'RETURN'
        | 'BACK'
        | 'OPEN_MESSAGE'
        | 'VIEW_PLAN';
    }
  | { type: 'WON'; score: number }
  | { type: 'SELECT_ACTIVITY'; activity: string; allowedActivities?: string[] }
  | { type: 'SELECT_DATE'; day: string; time: string }
  | { type: 'SELECT_PLACE'; place: string }
  | { type: 'GO_TO_SCENE'; scene: Scene };
export const initialState: LoveState = {
  scene: 'BOOT',
  noAttempts: 0,
  plan: emptyPlan,
};
export function loveReducer(state: LoveState, action: LoveAction): LoveState {
  const go = (scene: Scene): LoveState => ({ ...state, scene });
  switch (action.type) {
    case 'BOOT_DONE':
      return state.scene === 'BOOT' ? go('INVITATION') : state;
    case 'ACCEPT':
      return state.scene === 'INVITATION' ? go('YES_PROCESSING') : state;
    case 'DECLINE':
      return state.scene !== 'INVITATION'
        ? state
        : { ...state, noAttempts: (state.noAttempts % noMessages.length) + 1 };
    case 'NEXT': {
      const next: Partial<Record<Scene, Scene>> = {
        YES_PROCESSING: 'CONNECTED',
        CONNECTED: 'CELEBRATION',
        CELEBRATION: 'GAME_PROMPT',
        GAME_COMPLETE: 'ENDING',
        ENDING: 'ACTIVITY_PICKER',
      };
      return next[state.scene] ? go(next[state.scene]!) : state;
    }
    case 'PLAY':
      return state.scene === 'GAME_PROMPT' ? go('LOVE_SNAKE') : state;
    case 'WON':
      return state.scene === 'LOVE_SNAKE' && action.score >= 7
        ? go('GAME_COMPLETE')
        : state;
    case 'SELECT_ACTIVITY':
      return state.scene === 'ACTIVITY_PICKER' &&
        validActivity(action.allowedActivities ?? activities, action.activity)
        ? {
            ...state,
            scene: 'DATE_PICKER',
            plan: {
              ...state.plan,
              activity: action.activity,
              place:
                state.plan.activity === action.activity ? state.plan.place : '',
            },
          }
        : state;
    case 'SELECT_DATE':
      return state.scene === 'DATE_PICKER' &&
        isFuturePlan(action.day, action.time)
        ? {
            ...state,
            scene: 'PLACE_PICKER',
            plan: { ...state.plan, day: action.day, time: action.time },
          }
        : state;
    case 'SELECT_PLACE': {
      const place = action.place.trim();
      return state.scene === 'PLACE_PICKER' &&
        place.length > 0 &&
        place.length <= 70 &&
        isFuturePlan(state.plan.day, state.plan.time)
        ? {
            ...state,
            scene: 'MESSAGE_NOTIFICATION',
            plan: { ...state.plan, place },
          }
        : state;
    }
    case 'OPEN_MESSAGE':
      return state.scene === 'MESSAGE_NOTIFICATION' ? go('MESSAGE') : state;
    case 'VIEW_PLAN':
      return state.scene === 'MESSAGE' ? go('DATE_DETAILS') : state;
    case 'BACK': {
      const previous: Partial<Record<Scene, Scene>> = {
        DATE_PICKER: 'ACTIVITY_PICKER',
        PLACE_PICKER: 'DATE_PICKER',
        MESSAGE: 'MESSAGE_NOTIFICATION',
        DATE_DETAILS: 'MESSAGE',
      };
      return previous[state.scene] ? go(previous[state.scene]!) : state;
    }
    case 'RETURN':
      return state.scene === 'DATE_DETAILS'
        ? { ...initialState, scene: 'INVITATION' }
        : state;
    case 'GO_TO_SCENE':
      return { ...state, scene: action.scene };
    default:
      return state;
  }
}

function validActivity(options: string[], value: string): boolean {
  return value.length <= 70 && options.includes(value);
}
