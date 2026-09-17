/* Каталог тулов MCP и их выполнение — половина файла, отвечающая за ПРОДУКТ 2.
 *
 * Отрезано от api/mcp.js по шву, который там уже был обозначен комментарием «the worker side»
 * (SPLIT-PLAN §4.2). Поведение не менялось ни в одну сторону: это перенос, а не правка. Смысл в том,
 * чтобы на вопрос «чей это продукт» отвечало имя файла: здесь — то, что видит и зовёт собеседник по MCP,
 * в _mcp-worker.mjs — протокол машины, которая берёт работу, а в самом mcp.js остался только маршрут,
 * который монтирует обе половины.
 *
 * ПОЧЕМУ ЭТО НЕ КОСМЕТИКА. Отдавать каждому продукту свой НАБОР тулов — правка одной строки в массиве.
 * Отдавать продукту свой ДЕПЛОЙ — нельзя, пока callTool и ?worker=* лежат в одном модуле: шаг 8 плана
 * упирается ровно в это.
 */
import { structureOf } from './_skill-schema.mjs';
import { startLoop } from './_step.mjs';
import { procedureWith, seedFrom } from './_procedure.mjs';
import { missingParams } from '../extension/skills.js';
import { report } from './_report.js';
import { help } from './_help.mjs';
import { firstAt, readRule, ruleOf, ruleSaid, whenSaid } from './_schedule.mjs';
import { checksOf } from './_expect.mjs';
import { BROWSER_GOAL, WHERE, jobId, queueOne, scheduleId, workerSeen } from './_queue.mjs';
import { CASE_KEY, VERDICTS, checksFor, expectLine, readExpects, tallyOf, verdictSaid } from './_case.mjs';
import { casesFor, runsForCase } from './cases.js';


export const SPOKEN = new Set(['2024-11-05', '2025-03-26', '2025-06-18']);
export const NEWEST = '2025-06-18';
export const SERVER = { name: 'mouseflow', version: '0.2.0' };

/* How long a tools/call waits for a machine to do the work before it answers "still going".
 *
 * Was just under two minutes, which is well inside the function's own limit and well OUTSIDE what an MCP
 * client will hold a request open for: the first real call died as "Connection closed" while the job sat
 * happily in the queue, which tells the person nothing and looks exactly like a broken server. Half a minute
 * is under every client's patience, and the answer it gives when the wait runs out - the run id, and which
 * tool asks after it - is a better outcome than a dropped connection in every case. */
const CALL_WAIT_MS = 25_000;
const CALL_POLL_MS = 1_500;


/** RFC 6750 / RFC 9728: say it is a bearer resource and where the authorisation server will be found. */
export function unauthorized(req, res, why) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'mouse-agent.vercel.app';
  const resource = `https://${host}/api/mcp`;
  res.setHeader('WWW-Authenticate',
    `Bearer realm="MouseFlow", resource_metadata="https://${host}/.well-known/oauth-protected-resource"`
    + (why ? `, error="invalid_token", error_description="${why}"` : ''));
  res.status(401).json({
    error: why || 'missing_token',
    resource,
    hint: 'Add this URL to your client and sign in with your MouseFlow account - the 401 above names where. '
      + 'Or send Authorization: Bearer <device token>, minted in the app under Settings → My account. '
      + 'Either way it is one person: each sees only their own recordings and skills. '
      + `https://${host}/mcp explains all of it.`,
  });
}

export const rpc = (id, result) => ({ jsonrpc: '2.0', id: id ?? null, result });
export const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
export const say = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

/* ------------------------------------------------------------------------------- the account */

export const STATUS_TOOL = {
  name: 'mouseflow_status',
  description: 'What this MouseFlow account holds and whether a machine is listening for work: the number '
    + 'of skills, whether a worker has been seen recently, and anything queued or running. Ask this first '
    + 'when a skill call says nothing picked it up.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

export const STOP_TOOL = {
  name: 'mouseflow_stop',
  description: 'Cancel MouseFlow work that is queued or running on the user\'s machine. Safe to call when '
    + 'nothing is happening.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

export const RUN_STATUS_TOOL = {
  name: 'mouseflow_run_status',
  description: 'How a run that was still going is getting on. Only needed when a skill call came back '
    + 'saying it had not finished; it names the run id to pass here.',
  inputSchema: {
    type: 'object',
    properties: { run: { type: 'string', description: 'The run id the earlier answer named.' } },
    required: ['run'],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------------------------- reading the account
 *
 * These need nothing on anybody's machine. A recording, a run and the time they took are rows, and rows are
 * here - so the analysis half of this server works the moment a connector is added, with no worker, no
 * agent, and nothing to keep running. That is worth stating because it is the opposite of the run half,
 * which cannot happen without a machine, and the two arriving through one connector would otherwise look
 * like one capability with an intermittent fault.
 *
 * Metadata and prose, never a payload. There is no tool here that hands over raw events: the transcript is
 * the derivation api/_transcript.js already makes for the panel, which is written to be read.
 */

const RECORDINGS_TOOL = {
  name: 'mouseflow_recordings',
  description: 'What is on this MouseFlow account: recordings, and the skills made from them. Names, sizes, '
    + 'where they happened and when. Start here when the question is "what have I got".',
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['all', 'recording', 'skill'],
        default: 'all',
        description: 'A recording is what was captured; a skill is a copy of one meant to be handed over.',
      },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
    required: [],
    additionalProperties: false,
  },
};

const TRANSCRIPT_TOOL = {
  name: 'mouseflow_transcript',
  description: 'One recording, step by step, in words: what was clicked, in which application and window, '
    + 'how long each part took, and what the recording cannot answer. Takes an id from mouseflow_recordings.',
  inputSchema: {
    type: 'object',
    properties: {
      recording: { type: 'string', description: 'The id from mouseflow_recordings.' },
      steps: { type: 'integer', minimum: 1, maximum: 400, default: 120, description: 'How many steps to return.' },
    },
    required: ['recording'],
    additionalProperties: false,
  },
};

/* НЕ `mouseflow_runs`, и переименовано именно из-за соседа. Рядом стоит mouseflow_run, который двигает
 * настоящую мышь на чьём-то компьютере и не отменяется снаружи; имена, отличающиеся на одну `s`, - плохая
 * пара для инструмента, который выбирают по имени. Читающий тул теперь называется тем, что он отдаёт.
 *
 * Старое имя всё ещё ПРИНИМАЕТСЯ в tools/call - см. RETIRED ниже: клиент кэширует tools/list с момента
 * подключения, и переименование без синонима означает «no such tool» у всех, кто ещё не переподключался. */
const RUNS_TOOL = {
  name: 'mouseflow_run_history',
  description: 'The history of runs on this account: what was asked for, which model drove it, how it ended '
    + 'and how long it took. The record of what has actually been automated, as opposed to what could be. '
    + 'This only READS - mouseflow_run is the one that runs a skill.',
  inputSchema: {
    type: 'object',
    properties: {
      days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      outcome: { type: 'string', enum: ['any', 'ok', 'failed', 'stopped'], default: 'any' },
      limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
    required: [],
    additionalProperties: false,
  },
};

const ACTIVITY_TOOL = {
  name: 'mouseflow_activity',
  description: 'The account in numbers over a window: how much was recorded and for how long, how many runs '
    + 'and how they ended, and which applications the work happened in. For "where is my time going".',
  inputSchema: {
    type: 'object',
    properties: { days: { type: 'integer', minimum: 1, maximum: 365, default: 30 } },
    required: [],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------------------------- the timer
 *
 * Recording is the one thing on this list that is not a row: it is the agent watching the machine, so it
 * goes through the queue exactly as a skill run does, and needs the same thing listening. The two tools are
 * separate rather than one with a boolean, because "stop" is the one somebody reaches for in a hurry and a
 * tool that could start a recording when they meant to stop one is a bad trade for one fewer entry. */

export const START_TOOL = {
  name: 'mouseflow_start_recording',
  description: 'Start recording on the machine this account is paired with — the timer the app shows. It '
    + 'captures clicks, drags, scrolls and pointer movement, and THAT a key was pressed, never which key. '
    + 'Nothing is captured until this is called and it stops the moment recording stops.',
  inputSchema: {
    type: 'object',
    properties: {
      moveMs: {
        type: 'integer', minimum: 0, maximum: 1000, default: 0,
        description: 'How coarsely to sample pointer movement, in milliseconds. 0 keeps every sample; 40 is '
          + 'plenty for a long session and keeps it small.',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

export const STOP_RECORDING_TOOL = {
  name: 'mouseflow_stop_recording',
  description: 'Stop the recording running on the paired machine and save it to this account. Answers with '
    + 'what was captured.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

/* ОДНО ПРЕДЛОЖЕНИЕ ВМЕСТО ID НАВЫКА, и до сих пор такого не было НИ НА ОДНОЙ поверхности.
 *
 * Десять инструментов, и все про то, что уже записано: mouseflow_run берёт `skill`. Сказать «открой почту
 * и найди письмо от Ани» через MCP было нечем - цель попадала в очередь только как СОХРАНЁННЫЙ созданный
 * навык, то есть сначала её надо было где-то создать руками.
 *
 * ПОКА ТОЛЬКО БРАУЗЕР, и это не оговорка мелким шрифтом. Модель в цикле есть у расширения (runGoal в
 * extension/agent.js) - оно само решает один шаг за раз и само смотрит на страницу. У десктопного агента
 * своей модели нет вовсе: он ходит по шагам через ?worker=step, и чтобы дать ему свободную цель, менять
 * надо скомпилированный бинарник на чужой машине. Это отдельная работа, а не строчка здесь.
 *
 * Отдельным `#goal.browser`, а не общим `#goal`: очередь развозит работу по поверхностям, и команда,
 * которую может выполнить только одна из них, обязана это о себе говорить - иначе её заберёт тот, кто
 * ответит «не понимаю», и ход будет потрачен. */
export const DO_TOOL = {
  name: 'mouseflow_do',
  description: 'Have the MouseFlow browser extension carry out something described in plain language, in '
    + "the user's own Chrome, with their sessions already signed in. Use this when there is no saved skill "
    + 'for what is wanted. It looks at the page and decides one action at a time, so say what should be '
    + 'true at the end rather than which buttons to press. This acts on a real logged-in browser and the '
    + 'actions cannot be undone from here: an errand that sends, buys or deletes should be the one the user '
    + 'actually asked for. It needs "Let my AI run skills in this browser" switched on in the panel. For a '
    + 'DESKTOP errand there is no equivalent yet - the desktop agent carries no model of its own - so use '
    + 'mouseflow_run with a saved skill there.',
  inputSchema: {
    type: 'object',
    properties: {
      goal: {
        type: 'string',
        description: 'What should be done, in a sentence or two, as the user would say it. Name the things '
          + 'that matter - which account, which item, which recipient - because the run has only this.',
      },
    },
    required: ['goal'],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------------------------- the documentation
 *
 * THE FIRST QUESTION ANYBODY ASKS is not "run my skill", it is "what is this and what does it record". An
 * assistant with the tools above and no documentation answers that one anyway, out of the tool names and
 * whatever it read in training, and gets the load-bearing parts wrong: that keystroke CONTENT is never
 * captured, that a recorded skill and a goal skill fail in different ways, that only one half can replay a
 * browser skill. Those are the answers that turn into a support ticket or a privacy complaint.
 *
 * It reads the site's own pages - see api/_help.mjs for why it is fetched rather than copied in here. */
export const HELP_TOOL = {
  name: 'mouseflow_help',
  description: 'The MouseFlow documentation itself, fetched from mouse-flow.vercel.app/docs. Use it to answer any '
    + 'question about how MouseFlow works - what the recorder captures and what it never captures, skills '
    + 'and how they differ, the agent, the extension, teams, privacy, limits - INSTEAD of answering from '
    + 'memory. Ask a question to get the sections that answer it, name a page to read it whole, or call it '
    + 'with nothing to see the list of pages.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'What the person wants to know, in their own words. Keep their nouns - the words the '
          + 'documentation uses are the ones that find it.',
      },
      page: {
        type: 'string',
        description: 'A page id from an earlier answer (for example "record-a-flow" or "privacy-and-data") '
          + 'to read that page whole.',
      },
    },
    required: [],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------------------------- расписания как тулы
 *
 * «Юзер говорит, что сделать, и когда» - это буквально разговор, поэтому расписание обязано ставиться
 * голосом, а не только галочкой на экране. Три тула, а не один с полем `action`: инструмент выбирают по
 * имени, и «schedule» с action:'delete' - это способ удалить расписание, думая, что создаёшь его.
 *
 * ВРЕМЯ ГОВОРИТСЯ СЛОВАМИ, А НЕ CRON-СТРОКОЙ: `every: "1h"`, `at: "09:00"`, `days: "weekdays"`,
 * `once: "2026-09-03T09:00:00Z"`. Модели проще сказать «каждый час», чем `0 * * * *`, а человеку - проверить.
 *
 * ЗОНА ОБЯЗАТЕЛЬНА У ВРЕМЕНИ СУТОК, и это не придирка: у сервера нет часового пояса, у аккаунта тоже, и
 * «09:00» без зоны молча значит девять утра по UTC - для того, кто просил, середина ночи. Модель знает, где
 * человек, чаще, чем сервер: она видела это в разговоре. Поэтому тул её СПРАШИВАЕТ, а `readRule` отказывает,
 * если зона незнакомая, вместо того чтобы посчитать по UTC.
 */
export const SCHEDULE_TOOL = {
  name: 'mouseflow_schedule',
  description: 'Have a skill run by itself, later or repeatedly: "run this every hour", "every weekday at '
    + '09:00", "once tomorrow at 8". Say the time in words - every: "30m"/"1h"/"1d", or at: "09:00" with '
    + 'days: "all"/"weekdays", or once: an ISO instant - and pass the person\'s IANA time zone with `at`, '
    + 'because 09:00 with no zone means 09:00 UTC. A scheduled run only happens while their machine is '
    + 'awake and taking work; missed times are recorded, never run hours late.',
  inputSchema: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'The skill id from mouseflow_recordings. Its exact name works when only one has it.',
      },
      case: {
        type: 'string',
        description: 'A test case id from mouseflow_cases, INSTEAD of `skill` - the way a case is made to '
          + 'run nightly. Its checks and its inputs are read from the case each time it starts, so editing '
          + 'the case changes what tonight proves.',
      },
      arguments: {
        type: 'object',
        additionalProperties: true,
        description: 'What the skill asks for, by the input names mouseflow_recordings listed. A case '
          + 'carries its own; nothing here is needed with `case`.',
      },
      every: { type: 'string', description: 'Interval: "30m", "1h", "6h", "1d". Minimum 15 minutes.' },
      at: { type: 'string', description: 'Time of day, "09:00" or "17:30". Needs `zone`.' },
      days: { type: 'string', enum: ['all', 'weekdays'], description: 'Which days `at` applies to.' },
      once: { type: 'string', description: 'A single ISO instant, e.g. "2026-09-03T09:00:00Z".' },
      zone: {
        type: 'string',
        description: 'IANA time zone of the person asking, e.g. "Europe/Kiev". Required with `at`.',
      },
      label: { type: 'string', description: 'What to call this schedule, if the skill has more than one.' },
    },
    required: ['skill'],
    additionalProperties: false,
  },
};

export const SCHEDULES_TOOL = {
  name: 'mouseflow_schedules',
  description: 'The schedules on this account: what runs, when it next runs, and what happened last time - '
    + 'including "missed, nothing was listening". Use it before adding another, and to answer "what is set '
    + 'to run by itself?".',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

export const UNSCHEDULE_TOOL = {
  name: 'mouseflow_unschedule',
  description: 'Stop a schedule: pause it or remove it. Ask mouseflow_schedules for the ids. Pausing keeps '
    + 'it for later; removing forgets it. The skill itself is untouched either way.',
  inputSchema: {
    type: 'object',
    properties: {
      schedule: { type: 'string', description: 'The schedule id from mouseflow_schedules.' },
      pause: {
        type: 'boolean',
        description: 'True pauses it, false resumes it. Omit to remove it entirely.',
      },
    },
    required: ['schedule'],
    additionalProperties: false,
  },
};

/* ------------------------------------------------------------------------------- тест-кейсы
 *
 * ТРИ ТУЛА, И НИ ОДИН ИЗ НИХ НЕ ЗАПУСКАЕТ И НЕ СТАВИТ РАСПИСАНИЕ. Записать кейс, перечислить кейсы,
 * прочитать историю одного - это три вопроса о кейсах. А «прогони это сейчас» и «пусть идёт каждую ночь»
 * уже существуют тулами (mouseflow_run, mouseflow_schedule) и принимают `case` там, где принимали `skill`:
 * просьба одна и та же, и дублировать её ради нового вида работы значило бы держать две пары инструментов,
 * которые обязаны меняться вместе.
 *
 * ПОЧЕМУ КЕЙС ВООБЩЕ ЕСТЬ У МОДЕЛИ. Потому что «проверяй каждое утро, что счета уходят» - это то, что
 * говорят словами, а не то, что идут заполнять в форме; и потому что утверждения, записанные ЗАРАНЕЕ, - это
 * единственное, чем отличается регрессия от прогулки по экрану. Модель, которая решает про проверку в
 * момент прогона, каждую ночь проверяет немного другое.
 */
export const CASE_TOOL = {
  name: 'mouseflow_case',
  description: 'Write down a test case: one skill to run, plus what must be true when it is done. The '
    + 'checks are decided by the machine from the accessibility tree - never from a picture - so a nightly '
    + 'report means something. Then have it run by itself with mouseflow_schedule (pass `case`), or once '
    + 'now with mouseflow_run (pass `case`). The skill must be one made from a goal: a recording is '
    + 'replayed rather than decided, so nothing in it can check anything.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'What to call it - "Outlook still sends". It is what a report is read by.',
      },
      skill: {
        type: 'string',
        description: 'The skill that performs the steps, by id from mouseflow_recordings.',
      },
      arguments: {
        type: 'object',
        additionalProperties: true,
        description: 'What that skill asks for, by the input names mouseflow_recordings listed.',
      },
      expects: {
        type: 'array',
        description: 'What must be true - checked one by one with the expect tool. Say what each one '
          + 'proves: that sentence is what somebody reads in a red report. Each is checked at the END of '
          + 'the run unless it carries `after`, which names the moment it belongs to instead.',
        items: {
          type: 'object',
          properties: {
            check: {
              type: 'string',
              /* Оба словаря в одной схеме, а какие из них можно - решает поверхность скилла: у окна
               * приложения нет адреса, поэтому url_* и count_is там отвергаются при записи, а не молчат
               * ночью. text_is/text_contains и value_is/value_contains - два написания одного, принимаемые
               * взаимно (см. judge в api/_expect.mjs). */
              enum: ['present', 'absent', 'value_is', 'value_contains', 'text_is', 'text_contains',
                'enabled', 'disabled', 'url_is', 'url_contains', 'count_is'],
              description: 'present/absent, value_is/value_contains (text_is/text_contains say the same '
                + 'thing), enabled/disabled work everywhere. url_is, url_contains and count_is need a '
                + 'browser skill: a desktop window has no address and no exact count.',
            },
            name: { type: 'string', description: 'The control, as it appears on screen' },
            text: { type: 'string', description: 'For value_is and value_contains' },
            process: { type: 'string', description: 'Narrow to a process instead of the window in front' },
            why: { type: 'string', description: 'What this proves, in the case\'s own words' },
            /* КОГДА проверять - фразой, а не номером чекпоинта: у сохранённого скилла плана нет, а
             * ночной драйвер получает toolsFor(false) - без reached_checkpoint. См. api/_case.mjs. */
            after: {
              type: 'string',
              description: 'The moment this belongs to, as a sentence - "the message has been sent". '
                + 'Leave it out for a check that belongs at the end. Use it when the thing being checked '
                + 'would have moved on by the end: an outbox is empty after it sends, so checking it at '
                + 'the end is a different test.',
            },
          },
          required: ['check', 'name', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['name', 'skill', 'expects'],
    additionalProperties: false,
  },
};

export const CASES_TOOL = {
  name: 'mouseflow_cases',
  description: 'The test cases on this account: what each one runs, what it checks, when it next runs by '
    + 'itself, and how the last ten runs ended. Four outcomes, and they are not two: passed, failed a '
    + 'check (the product), no verdict (nothing was proven - the run did not finish, or a check could not '
    + 'be evaluated), and passed with repairs.',
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
};

export const CASE_RESULTS_TOOL = {
  name: 'mouseflow_case_results',
  description: 'One case\'s history: every run with its verdict, and for a failed one the checks that did '
    + 'not hold, in the words the case used. Ask mouseflow_cases for the ids. This is the tool to answer '
    + '"did anything break last night?".',
  inputSchema: {
    type: 'object',
    properties: {
      case: { type: 'string', description: 'The case id from mouseflow_cases.' },
      limit: { type: 'number', description: 'How many runs, newest first. Ten by default, fifty at most.' },
    },
    required: ['case'],
    additionalProperties: false,
  },
};

const CASE_TOOLS = [CASE_TOOL, CASES_TOOL, CASE_RESULTS_TOOL];


/* Строка расписания словами - один формат для перечня и для подтверждения, чтобы человек читал то же, что
 * прочитала модель. */
const scheduleSaid = (row) => {
  const rule = ruleOf(row);
  const bits = [
    `${row.id}  ${row.label || row.tool_name || row.flow_id}`,
    `  ${ruleSaid(rule)}`,
    `  next: ${row.paused ? `paused - ${row.paused_why || 'by hand'}` : whenSaid(
      row.next_at ? new Date(row.next_at).getTime() : null, rule.zone)}`,
  ];
  if (row.last_at) {
    bits.push(`  last: ${new Date(row.last_at).toISOString()} - ${row.last_said || 'no note'}`);
  }
  if (row.runs || row.misses) bits.push(`  ${row.runs} run(s), ${row.misses} missed`);
  return bits.join('\n');
};


/* A queue job that is an instruction to the agent rather than a skill. Marked by the flow id, so the claim
 * path can tell at a glance that there is no flow to look up. */
const AGENT_JOBS = {
  [START_TOOL.name]: '#record.start',
  [STOP_RECORDING_TOOL.name]: '#record.stop',
};

/* ИМЯ, КОТОРОЕ БОЛЬШЕ НЕ ПРЕДЛАГАЕТСЯ, но ещё принимается. Список инструментов клиент забирает один раз
 * при подключении и держит до следующего: в момент переименования у всех, кто уже подключён, в кэше стоит
 * старое имя, и вызов по нему обязан сработать, а не вернуть «нет такого инструмента». В tools/list его
 * нет - синоним не должен выглядеть как второй инструмент. Убрать можно тогда, когда не жаль сломать
 * сохранённый где-то промпт с этим словом. */
const RETIRED_RUNS = 'mouseflow_runs';

export const READ_TOOLS = [RECORDINGS_TOOL, TRANSCRIPT_TOOL, RUNS_TOOL, ACTIVITY_TOOL];

/** The caller's skills, stamped ones only, with their derived tool definitions. */
async function skillsOf(sql, userId) {
  const rows = await sql`
    select client_id, source, kind, name, description, payload, origins
    from user_flow
    where user_id = ${userId} and deleted_at is null
    order by updated_at desc
  `;
  const skills = [];
  let unstamped = 0;
  for (const row of rows) {
    const role = row.payload && typeof row.payload.role === 'string' ? row.payload.role : null;
    if (role === 'recording') continue;
    /* Stamped skills only, and deliberately stricter than the Skills page, which lists an unstamped row AS
     * a skill so that nothing anybody made before the stamp existed vanishes from their library. That
     * default is right for a page somebody reads and wrong for a tool list, which is read by something that
     * will CALL what is in it. The count is reported by mouseflow_status, so what is left out is visible. */
    if (role !== 'skill') { unstamped++; continue; }
    skills.push({
      id: row.client_id,
      source: row.source,
      kind: row.kind,
      name: row.name,
      description: row.description,
      payload: row.payload,
      origins: row.origins,
    });
  }
  return { skills, unstamped };
}

/** Tool name -> skill. Names are near-unique by construction; a collision is still handled. */
/* ONE tool for running a skill, instead of one tool per skill.
 *
 * A tool per skill is the shape that lets a model call a skill in a single step with its arguments checked
 * by a schema, and it was the right first answer. What it costs is paid in EVERY request, forever: measured
 * on this project's own account, a skill's definition is about 184 tokens, so fifty skills is roughly 9,200
 * tokens of tool definitions in front of every message - and a permission list of fifty entries named after
 * the date each recording was made.
 *
 * So the list stays constant and the skills move into a RESULT. `mouseflow_recordings` names them and their
 * inputs; this runs one. The names being unreadable stops mattering, because nobody reads a tool list to
 * find them any more.
 *
 * WHAT IS GIVEN UP, and it is not nothing: `arguments` is a free object, so a model can no longer be forced
 * by the schema to supply a required input. That guarantee moves one turn later - missingParams() already
 * refuses and names what is missing - so it holds, it just costs a round trip. A guarantee enforced by a
 * refusal is weaker than one enforced by a type, and this is the trade being made on purpose.
 */
export const RUN_TOOL = {
  name: 'mouseflow_run',
  description: 'Run one skill on the machine this account is paired with. Ask mouseflow_recordings for the '
    + 'skills and the inputs each one takes. This drives a real mouse and keyboard on somebody\'s computer: '
    + 'the actions cannot be undone from here, and a missing input should be asked for rather than guessed.',
  inputSchema: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'The skill\'s id from mouseflow_recordings. Its exact name also works when only one '
          + 'skill has it.',
      },
      case: {
        type: 'string',
        description: 'A test case id from mouseflow_cases, INSTEAD of `skill`: runs the case once now, the '
          + 'same way its schedule would run it at two in the morning - its checks included.',
      },
      arguments: {
        type: 'object',
        description: 'What the skill asks for, by the input names mouseflow_recordings listed. Omit for a '
          + 'skill that asks for nothing, and with `case`, which carries its own.',
        additionalProperties: true,
      },
    },
    required: [],
    additionalProperties: false,
  },
};

function tableOf(skills) {
  const table = new Map();
  for (const flow of skills) {
    const structure = structureOf(flow);
    let name = structure.toolName;
    if (table.has(name)) {
      let n = 2;
      while (table.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    table.set(name, { flow, structure });
  }
  return table;
}

/* ------------------------------------------------------------------------------- the queue */

/* WHERE, jobId, workerSeen и постановка одной работы переехали в api/_queue.mjs - их спрашивает вторая
 * дверь. Кейс запускается кнопкой на странице тестов (api/cases.js), и оба отказа - «машины нет» и «одна
 * мышь» - обязаны звучать теми же словами, что здесь: инструкция, живущая в двух копиях, устаревает в одной
 * из них, и именно это здесь однажды и произошло. */


/* How recently a step-capable agent has to have asked for work to count as listening.
 *
 * Longer than the claim's own long poll (25s), so an agent that is polling normally is always inside it,
 * and short enough that a machine whose agent has gone away starts using its worker again within a minute
 * and a half rather than never. */
const AGENT_LISTENING_MS = 90_000;



/* ------------------------------------------------------------------------------- the tools */

/* ------------------------------------------------------------------------------- the read tools */

const ago = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16).replace('T', ' ') : 'unknown');

async function readRecordings(sql, who, args) {
  const want = ['recording', 'skill'].includes(args.kind) ? args.kind : 'all';
  const limit = Math.min(200, Math.max(1, Math.round(Number(args.limit) || 50)));
  const rows = await sql`
    select client_id, name, description, source, kind, origins, updated_at, payload,
           payload->>'role' as role,
           jsonb_array_length(coalesce(payload->'events', '[]'::jsonb)) as events
    from user_flow
    where user_id = ${who.id} and deleted_at is null
    order by updated_at desc limit ${limit}
  `;
  const kindOf = (r) => (r.role === 'skill' ? 'skill' : r.role === 'recording' ? 'recording' : 'unmarked');
  const shown = rows.filter((r) => want === 'all' || kindOf(r) === want);
  if (!shown.length) return say(want === 'all' ? 'Nothing on this account yet.' : `No ${want}s on this account.`);

  const lines = shown.map((r) => {
    const where = Array.isArray(r.origins) && r.origins.length ? ` in ${r.origins.slice(0, 3).join(', ')}` : '';
    /* THE INPUTS, for a skill. Without them this listing names things a caller cannot use: skills are run
     * through mouseflow_run now, whose `arguments` is a free object, so the only way to learn what a skill
     * asks for is to be told here. It used to be in the per-skill tool's schema; that tool is gone. */
    const asks = kindOf(r) === 'skill'
      ? (structureOf(r).params || [])
        .map((p) => `${p.name} (${p.type}${p.example ? '' : ', required'})`)
      : [];
    return `${r.client_id}  ${r.name || 'untitled'}\n`
      + `    ${kindOf(r)} · ${r.source || 'unknown'} · ${r.events} events${where} · ${day(r.updated_at)}`
      + (asks.length ? `\n    takes: ${asks.join(', ')}` : '')
      + (r.description ? `\n    ${r.description}` : '');
  });
  return say(`${shown.length} of ${rows.length} shown, newest first.\n\n${lines.join('\n')}`);
}

async function readTranscript(sql, who, args) {
  const id = String(args.recording || '');
  if (!id) return say('Which recording? Pass an id from mouseflow_recordings.', true);
  const [row] = await sql`
    select client_id, name, kind, source, payload, origins
    from user_flow where user_id = ${who.id} and client_id = ${id} and deleted_at is null
  `;
  if (!row) return say(`There is nothing called "${id}" on this account.`, true);

  /* Lazily, for the reason api/chat.js states about the same module: a static import of a file that may not
   * be on a given deploy takes the importing route down with it, and one missing file must not stop the
   * tools that have nothing to do with transcripts. */
  let transcribe;
  try {
    ({ transcribe } = await import('./_transcript.js'));
  } catch (err) {
    return say(`The transcript engine could not be loaded on this deployment: ${err.message}`, true);
  }

  const t = transcribe(row);
  const cap = Math.min(400, Math.max(1, Math.round(Number(args.steps) || 120)));
  const out = [];
  out.push(`${t.flow?.name || row.name} — ${t.summary?.events ?? 0} events, `
    + `${t.summary?.clicks ?? 0} clicks, ${t.summary?.seconds ?? 0}s, `
    + `${t.summary?.applications ?? 0} applications.`);

  let shown = 0;
  let dropped = 0;
  for (const seg of t.segments || []) {
    const where = seg.where && seg.where.label ? seg.where.label : 'somewhere';
    out.push(`\n— ${where}`);
    for (const step of seg.steps || []) {
      if (shown >= cap) { dropped++; continue; }
      shown++;
      out.push(`  ${step.n}. ${step.what}${step.control ? ` [${step.control}]` : ''}`);
    }
  }
  /* Silent truncation reads as "that is all of it". */
  if (dropped) out.push(`\n${dropped} further steps not shown — ask for more with a bigger \`steps\`.`);

  if ((t.gaps || []).length) {
    out.push('\nWhat this recording cannot answer:');
    for (const gap of t.gaps) out.push(`  · ${gap.question} — ${gap.why}`);
  }
  return say(out.join('\n'));
}

async function readRuns(sql, who, args) {
  const days = Math.min(365, Math.max(1, Math.round(Number(args.days) || 30)));
  const limit = Math.min(200, Math.max(1, Math.round(Number(args.limit) || 50)));
  const wanted = ['ok', 'failed', 'stopped'].includes(args.outcome) ? args.outcome : null;
  const rows = await sql`
    select client_id, kind, goal, model, flow_id, outcome, summary, error, started_at, finished_at
    from user_run
    where user_id = ${who.id} and started_at >= ${ago(days)}
      and (${wanted}::text is null or outcome = ${wanted})
    order by started_at desc limit ${limit}
  `;
  if (!rows.length) return say(`No runs in the last ${days} days${wanted ? ` that ended "${wanted}"` : ''}.`);

  const lines = rows.map((r) => {
    const took = r.started_at && r.finished_at
      ? `${Math.max(0, Math.round((new Date(r.finished_at) - new Date(r.started_at)) / 1000))}s`
      : 'unknown';
    return `${day(r.started_at)}  ${r.outcome.padEnd(7)} ${took.padStart(6)}  ${r.kind}`
      + `${r.model ? ` · ${r.model}` : ''}\n    ${(r.goal || '(no goal recorded)').slice(0, 160)}`
      + (r.error ? `\n    failed: ${String(r.error).slice(0, 200)}` : '');
  });
  return say(`${rows.length} runs in the last ${days} days, newest first.\n\n${lines.join('\n')}`);
}

async function readActivity(sql, who, args) {
  const days = Math.min(365, Math.max(1, Math.round(Number(args.days) || 30)));
  const since = ago(days);
  const [made] = await sql`
    select count(*) filter (where payload->>'role' is distinct from 'skill')::int as recordings,
           count(*) filter (where payload->>'role' = 'skill')::int as skills,
           coalesce(sum(jsonb_array_length(coalesce(payload->'events', '[]'::jsonb))), 0)::int as events
    from user_flow where user_id = ${who.id} and deleted_at is null and updated_at >= ${since}
  `;
  const outcomes = await sql`
    select outcome, count(*)::int as n,
           coalesce(sum(extract(epoch from (finished_at - started_at))), 0)::int as seconds
    from user_run where user_id = ${who.id} and started_at >= ${since}
    group by outcome order by n desc
  `;
  const apps = await sql`
    select lower(o) as app, count(*)::int as n
    from user_flow, unnest(coalesce(origins, array[]::text[])) as o
    where user_id = ${who.id} and deleted_at is null and updated_at >= ${since}
    group by lower(o) order by n desc limit 8
  `;

  const runs = outcomes.reduce((n, r) => n + r.n, 0);
  const ok = outcomes.find((r) => r.outcome === 'ok');
  const seconds = outcomes.reduce((n, r) => n + r.seconds, 0);
  const lines = [
    `Last ${days} days.`,
    `Recorded: ${made.recordings} recording${made.recordings === 1 ? '' : 's'} and ${made.skills} `
      + `skill${made.skills === 1 ? '' : 's'}, ${made.events} events between them.`,
    runs
      ? `Runs: ${runs}, of which ${ok ? ok.n : 0} finished ok`
        + ` (${outcomes.map((r) => `${r.outcome} ${r.n}`).join(', ')}), `
        + `${Math.round(seconds / 60)} minutes of running time.`
      : 'Runs: none.',
    apps.length ? `Where the work was: ${apps.map((a) => `${a.app} (${a.n})`).join(', ')}.` : '',
    /* Named rather than left to be inferred from a small number: this counts what the account HOLDS, and a
     * recording deleted last week is not in it. */
    'Counted from what the account holds now — anything deleted since is not in these numbers.',
  ].filter(Boolean);
  return say(lines.join('\n'));
}

/* ------------------------------------------------------------------------------- the tools */

export async function callTool(sql, who, params, req) {
  const asked = params && params.name;
  const args = (params && params.arguments) || {};

  if (asked === RECORDINGS_TOOL.name) return readRecordings(sql, who, args);
  if (asked === TRANSCRIPT_TOOL.name) return readTranscript(sql, who, args);
  if (asked === RUNS_TOOL.name || asked === RETIRED_RUNS) return readRuns(sql, who, args);
  if (asked === ACTIVITY_TOOL.name) return readActivity(sql, who, args);

  /* No account, no database and no machine: the documentation is public, and a question about how the
   * product works should be answerable while a person is still deciding whether to attach a computer. */
  if (asked === HELP_TOOL.name) {
    return say(await help({ question: String(args.question || ''), page: String(args.page || '') }));
  }

  /* ------------------------------------------------------------------ расписания */

  if (asked === SCHEDULES_TOOL.name) {
    const rows = await sql`
      select id, flow_id, tool_name, label, kind, every_minutes, at_minutes, days, zone,
             next_at, paused, paused_why, last_at, last_said, runs, misses
      from user_schedule
      where user_id = ${who.id} and deleted_at is null
        /* Отработавшие одноразовые, записанные до того, как они стали завершаться. По ПРИЧИНЕ паузы, а не
         * по пустому сроку: у пропущенного одноразового срока тоже нет, а оно должно остаться видимым -
         * ради этого пропуск и записывается. */
        and coalesce(paused_why, '') <> 'it was a one-off, and it has run'
      order by paused, next_at nulls last
    `;
    if (!rows.length) {
      return say('Nothing is scheduled on this account. mouseflow_schedule sets one up - a skill plus when.');
    }
    /* Условие исполнения названо ЗДЕСЬ, а не только в описании тула: перечень расписаний - это то место,
     * где человек спрашивает «почему не сработало», и ответ должен стоять рядом с ответом. */
    return say(`${rows.length} schedule${rows.length === 1 ? '' : 's'}:\n\n`
      + rows.map(scheduleSaid).join('\n\n')
      + '\n\nA scheduled run happens only while that machine is awake and taking work; a time missed '
      + 'because nothing was listening is recorded as missed rather than run late.');
  }

  if (asked === SCHEDULE_TOOL.name) {
    /* СКИЛЛ ИЛИ КЕЙС - один инструмент, потому что просьба одна: «пусть это идёт само». Второй тул
     * «расписание для кейса» пришлось бы держать в паре с этим до конца времён, и пауза, снятие с паузы,
     * пропуски и «три провала подряд» существовали бы в двух экземплярах. Работа кейса отличается ровно
     * одним ключом в аргументах - указателем на кейс, - а всё остальное в строке то же. */
    const askedCase = String((args && args.case) || '').trim();
    const wanted = String((args && args.skill) || '').trim();
    if (!wanted && !askedCase) {
      return say('Which skill? Pass the id from mouseflow_recordings as `skill` - or a case id as `case`, '
        + 'to have a test case run by itself.', true);
    }

    /* Правило разбирается ДО поиска скилла: «каждые пять минут» отвергается одинаково, существует скилл или
     * нет, и человеку не приходится сначала узнавать про опечатку в имени, а потом про интервал. */
    const read = readRule(args);
    if (read.why) return say(read.why, true);
    const rule = read.rule;
    if (rule.kind === 'daily' && !args.zone) {
      return say('`at` needs `zone` - an IANA name like "Europe/Kiev". Without it "09:00" means 09:00 UTC, '
        + 'which is the middle of the night for most of the people who ask for nine in the morning.', true);
    }

    /* Что ставится: id потока, имя для строки, и аргументы работы. У кейса аргументы - только указатель:
     * значения параметров и утверждения читает драйвер из его строки в момент старта, поэтому кейс,
     * поправленный после постановки расписания, ночью идёт в новой редакции. */
    let put = null;
    if (askedCase) {
      const found = await sql`
        select id, name, flow_id, expects from user_case
        where id = ${askedCase} and user_id = ${who.id} and deleted_at is null
      `.catch(() => []);
      if (!found.length) {
        return say(`There is no case "${askedCase}" on this account. Ask mouseflow_cases for what there is.`,
          true);
      }
      if (!Array.isArray(found[0].expects) || !found[0].expects.length) {
        return say('That case has no checks, so there is nothing it could prove every night.', true);
      }
      put = {
        flowId: found[0].flow_id,
        name: found[0].name,
        args: { [CASE_KEY]: { id: found[0].id } },
      };
    } else {
      const { skills } = await skillsOf(sql, who.id);
      let entry = skills.find((f) => f.id === wanted) || null;
      if (!entry) {
        const named = skills.filter((f) => String(f.name || '').trim() === wanted);
        if (named.length > 1) {
          return say(`${named.length} skills are called "${wanted}". Pass one of these ids instead: `
            + `${named.map((f) => f.id).join(', ')}.`, true);
        }
        if (named.length === 1) entry = named[0];
      }
      if (!entry) {
        return say(`There is no skill "${wanted}" on this account. Ask mouseflow_recordings for what there is.`,
          true);
      }
      put = { flowId: entry.id, name: entry.name, args: (args && args.arguments) || {} };
    }

    const at = firstAt(rule, Date.now());
    if (at == null || at < Date.now() - 60_000) {
      return say(`That time has already passed (${new Date(at ?? Date.now()).toISOString()}). Pass a moment `
        + 'in the future, or use `every`/`at` for something that repeats.', true);
    }

    /* Зона запоминается на аккаунте, чтобы облачный прогон мог сказать модели, который час у человека
     * (см. startLoop в api/_step.mjs). Фон: не записалось - расписание всё равно ставится. */
    if (args.zone) {
      await sql`
        insert into user_pref (user_id, key, value) values (${who.id}, 'zone', ${String(args.zone).slice(0, 64)})
        on conflict (user_id, key) do update set value = excluded.value, updated_at = now()
      `.catch(() => {});
    }

    const id = scheduleId();
    try {
      await sql`
        insert into user_schedule (
          id, user_id, flow_id, tool_name, args, label,
          kind, every_minutes, at_minutes, days, zone, next_at
        ) values (
          ${id}, ${who.id}, ${put.flowId}, ${RUN_TOOL.name},
          ${JSON.stringify(put.args)},
          ${String((args && args.label) || put.name || '').slice(0, 80)},
          ${rule.kind}, ${rule.everyMinutes ?? null}, ${rule.atMinutes ?? null},
          ${rule.days || 'all'}, ${rule.zone}, ${new Date(at).toISOString()}
        )
      `;
    } catch (err) {
      /* Таблицы нет - миграция не применена. Сказать прямо: «не удалось» без причины отправляет человека
       * искать ошибку в своём запросе. */
      return say(`The schedule could not be saved: ${err.message}. If this deployment has not had `
        + 'db/018_user_schedule.sql applied yet, that is the reason.', true);
    }

    /* Условие исполнения - в подтверждении, а не в мелком шрифте: расписание, о котором человек думает, что
     * оно сработает при закрытом ноутбуке, хуже отсутствующего. */
    const listening = await workerSeen(sql, who.id);
    return say(`Scheduled: "${put.name}" ${ruleSaid(rule)}.\n`
      + `Next run ${whenSaid(at, rule.zone)}. Its id is ${id}.\n\n`
      + (listening === null
        ? 'No computer has ever taken work for this account, so nothing will run this until one does: '
          + `${WHERE}.`
        : 'It runs only while that machine is awake and taking work. A time missed because nothing was '
          + 'listening is recorded as missed rather than run hours late, and three failures in a row pause '
          + 'the schedule.'));
  }

  if (asked === UNSCHEDULE_TOOL.name) {
    const id = String((args && args.schedule) || '').trim();
    if (!id) return say('Which schedule? Pass the id from mouseflow_schedules as `schedule`.', true);
    const rows = await sql`
      select id, label, kind, every_minutes, at_minutes, days, zone, next_at
      from user_schedule where id = ${id} and user_id = ${who.id} and deleted_at is null
    `;
    if (!rows.length) return say(`There is no schedule "${id}" on this account.`, true);
    const row = rows[0];

    if (args.pause === undefined) {
      await sql`update user_schedule set deleted_at = now(), updated_at = now() where id = ${id}`;
      return say(`Removed. "${row.label || id}" will not run by itself again; the skill itself is untouched.`);
    }
    const pausing = args.pause !== false;
    /* Снятие с паузы обязано пересчитать срок: сохранённый next_at за время паузы утёк в прошлое, и без
     * пересчёта расписание сработало бы сразу - или, при большом опоздании, отметилось пропущенным в тот же
     * миг, что и возобновилось. */
    const rule = ruleOf(row);
    const next = pausing ? row.next_at : firstAt(rule, Date.now());
    await sql`
      update user_schedule
      set paused = ${pausing}, paused_why = ${pausing ? 'paused by hand' : null},
          next_at = ${next ? new Date(typeof next === 'number' ? next : next).toISOString() : null},
          updated_at = now()
      where id = ${id}
    `;
    return pausing
      ? say(`Paused. "${row.label || id}" keeps its ${ruleSaid(rule)} and runs nothing until resumed.`)
      : say(`Resumed. Next run ${whenSaid(typeof next === 'number' ? next : null, rule.zone)}.`);
  }

  /* ------------------------------------------------------------------ тест-кейсы */

  if (asked === CASE_TOOL.name) {
    const name = String((args && args.name) || '').trim().slice(0, 120);
    if (!name) return say('What should the case be called? It is what a report is read by.', true);
    const wantedSkill = String((args && args.skill) || '').trim();
    if (!wantedSkill) return say('Which skill performs the steps? Pass its id as `skill`.', true);

    const { skills } = await skillsOf(sql, who.id);
    let entry = skills.find((f) => f.id === wantedSkill) || null;
    if (!entry) {
      const named = skills.filter((f) => String(f.name || '').trim() === wantedSkill);
      if (named.length > 1) {
        return say(`${named.length} skills are called "${wantedSkill}". Pass one of these ids instead: `
          + `${named.map((f) => f.id).join(', ')}.`, true);
      }
      if (named.length === 1) entry = named[0];
    }
    if (!entry) {
      return say(`There is no skill "${wantedSkill}" on this account. Ask mouseflow_recordings for what `
        + 'there is.', true);
    }
    /* Запись кейсом быть не может, и отказ должен прийти сейчас, а не в 02:00: её воспроизводит агент без
     * модели - экран никто не читает, и вызвать expect некому. */
    if (entry.kind !== 'created') {
      return say(`"${entry.name}" is a recording: it is replayed rather than decided, so nothing in it can `
        + 'check anything. Make a skill from it on the Skills page and build the case on that.', true);
    }

    /* УТВЕРЖДЕНИЯ ПРОВЕРЯЮТСЯ ПОСЛЕ СКИЛЛА, И НАБОРОМ ЕГО ПОВЕРХНОСТИ. Той же функцией, что у страницы -
     * список, принятый одной дверью и отвергнутый другой, это два разных представления о том, что такое
     * кейс, - но набор видов у поверхностей разный: адрес страницы и точное число совпадений знает только
     * документ, а у окна приложения адреса нет вовсе. Сказать это при записи дешевле, чем ночью. */
    const on = entry.source && entry.source !== 'desktop' ? 'browser' : 'desktop';
    /* ЧЕКИ СКИЛЛА, КОГДА СВОИХ НЕ ДАЛИ - той же функцией, что у страницы (SPLIT-PLAN §9, шаг 1b). Дверь,
     * которая сеет, и дверь, которая не сеет, - это два разных представления о том, что такое кейс, ровно
     * как и два разных судьи. */
    const sow = seedFrom(args && args.expects, entry);
    const read = readExpects(sow.list, checksFor(on));
    if (read.why) return say(read.why, true);

    const id = `cs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try {
      await sql`
        insert into user_case (id, user_id, name, flow_id, args, expects)
        values (${id}, ${who.id}, ${name}, ${entry.id},
                ${JSON.stringify((args && args.arguments) || {})}, ${JSON.stringify(read.expects)})
      `;
    } catch (err) {
      return say(`The case could not be saved: ${err.message}. If this deployment has not had `
        + 'db/021_user_case.sql applied yet, that is the reason.', true);
    }
    /* И обратно на скилл - чтобы следующий кейс, и тот, кто поставит навык из галереи, начинали с них.
     * Посеянное не пишется: оно оттуда и пришло. Неудача записи кейс не отменяет. */
    let kept = sow.seeded;
    if (!sow.seeded) {
      const payload = procedureWith(entry.payload, read.expects);
      if (payload) {
        try {
          await sql`
            update user_flow set payload = ${JSON.stringify(payload)}, updated_at = now()
            where user_id = ${who.id} and client_id = ${entry.id} and deleted_at is null
          `;
          kept = true;
        } catch (_) { kept = false; }
      }
    }
    return say(`Case "${name}" written down as ${id}.\n`
      + (sow.seeded
        ? "Its checks came from the skill's own procedure - it already said what \"done\" means.\n"
        : kept ? 'Its checks are now on the skill too, so the next case starts from them.\n' : '')
      + `It runs "${entry.name}" and then checks ${read.expects.length} thing`
      + `${read.expects.length === 1 ? '' : 's'}:\n`
      + `${read.expects.map((one, i) => `  ${i + 1}. ${expectLine(one)}`).join('\n')}\n\n`
      + `To have it run by itself: ${SCHEDULE_TOOL.name} with case: "${id}" and a time - for a nightly `
      + 'regression, at: "02:00" with days: "weekdays" and the person\'s zone. To run it once now: '
      + `${RUN_TOOL.name} with case: "${id}". Either way it only runs while that machine is awake and `
      + 'taking work.');
  }

  if (asked === CASES_TOOL.name) {
    let held;
    try {
      held = await casesFor(sql, who.id);
    } catch (err) {
      return say(`The cases could not be read: ${err.message}. If this deployment has not had `
        + 'db/021_user_case.sql applied yet, that is the reason.', true);
    }
    if (!held.cases.length) {
      return say(`No test cases on this account. ${CASE_TOOL.name} writes one down: a skill to run, plus `
        + 'what must be true when it is done.');
    }
    const lines = held.cases.map((one) => {
      const runs = held.runs.get(one.id) || [];
      const flow = held.names.get(one.flow_id) || null;
      const sch = held.next.get(one.id) || null;
      const tally = tallyOf(runs.map((r) => r.verdict));
      const bits = [
        `${one.id}  ${one.name}`,
        `  runs: ${flow ? `"${flow.name}"` : `${one.flow_id} - THE SKILL IS GONE, so this case fails at the gate`}`,
        `  checks: ${(Array.isArray(one.expects) ? one.expects : []).map(expectLine).join('; ') || 'none'}`,
      ];
      /* СРОК И УСЛОВИЕ ЕГО ИСПОЛНЕНИЯ - рядом: расписание, о котором думают, что оно сработает при
       * закрытом ноутбуке, хуже отсутствующего. */
      if (sch) {
        bits.push(`  by itself: ${ruleSaid(ruleOf(sch))}, next ${sch.paused
          ? `paused - ${sch.paused_why || 'by hand'}`
          : whenSaid(sch.next_at ? new Date(sch.next_at).getTime() : null, sch.zone)}`);
      } else {
        bits.push('  by itself: not scheduled');
      }
      if (!runs.length) bits.push('  never run');
      else {
        const last = runs[0];
        bits.push(`  last ${runs.length} run(s): ${runs.map((r) => VERDICTS[r.verdict].word).join(', ')}`);
        bits.push(`  latest: ${new Date(last.finishedAt || last.startedAt).toISOString()} - `
          + `${verdictSaid(last.verdict)}${last.summary ? ` - ${last.summary}` : ''}`);
        if (tally.fail) bits.push(`  ${tally.fail} of those found a defect - ${CASE_RESULTS_TOOL.name} says which check`);
      }
      return bits.join('\n');
    });
    return say(`${held.cases.length} case${held.cases.length === 1 ? '' : 's'}:\n\n${lines.join('\n\n')}\n\n`
      + '"no verdict" is not a failure: it means nothing was proven - the run did not finish, or a check '
      + 'could not be evaluated. A case runs only while its machine is awake and taking work.');
  }

  if (asked === CASE_RESULTS_TOOL.name) {
    const id = String((args && args.case) || '').trim();
    if (!id) return say(`Which case? Pass the id from ${CASES_TOOL.name} as \`case\`.`, true);
    const rows = await sql`
      select id, name, flow_id, expects from user_case
      where id = ${id} and user_id = ${who.id} and deleted_at is null
    `.catch(() => []);
    if (!rows.length) return say(`There is no case "${id}" on this account.`, true);
    const limit = Math.max(1, Math.min(50, Math.round(Number(args && args.limit) || 10)));
    const runs = await runsForCase(sql, who.id, id, limit);
    if (!runs.length) {
      return say(`"${rows[0].name}" has never run. ${RUN_TOOL.name} with case: "${id}" runs it once now; `
        + `${SCHEDULE_TOOL.name} with case: "${id}" has it run by itself.`);
    }
    const tally = tallyOf(runs.map((r) => r.verdict));
    const lines = runs.map((run) => {
      const bits = [`${new Date(run.finishedAt || run.startedAt).toISOString()}  ${VERDICTS[run.verdict].word}`];
      if (run.summary) bits.push(`  said: ${run.summary}`);
      if (run.error) bits.push(`  error: ${run.error}`);
      /* ЧТО ИМЕННО НЕ СОШЛОСЬ - словами самого утверждения, из записанных шагов. Иначе красная строка
       * оставляет человека с числом «1 check failed» и догадкой.
       *
       * `tool || name`, А НЕ `tool`: расширение пишет имя шага в `name` (extension/agent.js), оба
       * десктопных драйвера - в `tool`. Читая одно поле, эта строка молчала о ВЕБ-кейсах - то есть о той
       * половине, где проверок больше всего, и молчала бы тем убедительнее, чем больше их там становится.
       * Та же идиома, что в checksOf (extension/checks.js) и в lateBound (api/_case.mjs). */
      const failed = (Array.isArray(run.steps) ? run.steps : [])
        .filter((step) => step && (step.tool || step.name) === 'expect'
          && step.outcome && step.outcome.pass === false)
        .map((step) => `    ${expectLine(step.input || {})} -> ${step.outcome.evidence || 'did not hold'}`
          + `${step.outcome.how ? ` (${step.outcome.how})` : ''}`);
      if (failed.length) bits.push('  did not hold:', ...failed);
      /* ПРОВЕРКА, ПРИВЯЗАННАЯ К МОМЕНТУ И СДЕЛАННАЯ ВСЁ РАВНО В КОНЦЕ. Названа, но вердикта не меняет:
       * одна запоздавшая проверка не отменяет найденного дефекта - а промолчать о ней значило бы сделать
       * `after` украшением, потому что снаружи такой прогон выглядит как честный. */
      if (run.late > 0) {
        bits.push(`  ${run.late} check${run.late === 1 ? '' : 's'} bound to a moment `
          + `${run.late === 1 ? 'was' : 'were'} made at the end anyway - what they check had moved on by `
          + 'then, so this ran as a weaker test than it says');
      }
      if (run.checks) {
        bits.push(`  checks: ${run.checks.passed} held, ${run.checks.failed} did not, `
          + `${run.checks.unchecked} could not be checked`);
      }
      return bits.join('\n');
    });
    return say(`"${rows[0].name}" - ${runs.length} run(s), newest first:\n\n${lines.join('\n\n')}\n\n`
      + `${tally.pass} passed, ${tally.fail} found a defect, ${tally.blocked} proved nothing`
      + `${tally.pass_with_repairs ? `, ${tally.pass_with_repairs} passed with repairs` : ''}. `
      + 'A "no verdict" night is not a failing test: it is a night nobody learned anything, and the reason '
      + 'is in that run\'s own words above.');
  }

  if (asked === STATUS_TOOL.name) {
    const { skills, unstamped } = await skillsOf(sql, who.id);
    const seen = await workerSeen(sql, who.id);
    const busy = await sql`
      select id, tool_name, state, created_at from run_queue
      where user_id = ${who.id} and state in ('queued', 'claimed')
      order by created_at limit 10
    `;
    const lines = [];
    lines.push(`${skills.length} skill${skills.length === 1 ? '' : 's'} on this account, of which `
      + `${skills.filter((s) => s.source === 'desktop').length} run on a desktop and `
      + `${skills.filter((s) => s.source !== 'desktop').length} in the browser extension.`);
    if (seen === undefined) {
      lines.push('Whether a machine is listening cannot be read on this deployment.');
    } else if (!seen) {
      lines.push('No machine has ever asked this account for work. To let one, ' + WHERE + '. '
        + 'It takes one click and nothing is typed or copied.');
    } else {
      const ago = Math.round((Date.now() - seen.getTime()) / 1000);
      lines.push(ago < 90
        ? `A machine is listening for work (last asked ${ago}s ago).`
        : `No machine has asked for work in ${Math.round(ago / 60)} minutes, so a call would sit in the `
          + 'queue. That computer may be asleep or off, or it may have stopped taking work - the switch is '
          + "in the MouseFlow agent's own menu bar, the cursor icon at the top of the screen.");
    }
    if (busy.length) {
      lines.push(`Queued or running: ${busy.map((b) => `${b.tool_name || b.id} (${b.state})`).join(', ')}.`);
    }
    if (unstamped) {
      lines.push(`${unstamped} row${unstamped === 1 ? '' : 's'} on the account are not marked as either a `
        + 'recording or a skill, and are not offered as tools. Saving them again in the app stamps them.');
    }
    lines.push('What this cannot see: the agent itself. It listens on the machine\'s own loopback, and this '
      + 'is not on that machine.');
    return say(lines.join('\n'));
  }

  if (asked === STOP_TOOL.name) {
    const killed = await sql`
      update run_queue set state = 'cancelled', finished_at = now(),
             ok = false, said = 'cancelled before it finished'
      where user_id = ${who.id} and state in ('queued', 'claimed')
      returning id
    `;
    return say(killed.length
      ? `Cancelled ${killed.length} job${killed.length === 1 ? '' : 's'}. A run already under way stops at `
        + 'the next step the worker checks, which is within a second or two.'
      : 'Nothing was queued or running.');
  }

  if (asked === RUN_STATUS_TOOL.name) {
    const id = String(args.run || '');
    const rows = await sql`
      select state, ok, said, finished_at from run_queue where id = ${id} and user_id = ${who.id}
    `;
    if (!rows.length) return say(`There is no run "${id}" on this account.`, true);
    const job = rows[0];
    if (job.state === 'queued') return say('Still waiting for a machine to pick it up.');
    if (job.state === 'claimed') return say('A machine has it and is working on it.');
    return say(job.said || (job.ok ? 'Done.' : 'It did not finish.'), !job.ok);
  }

  /* The timer, and skills. Both are the same thing from here: something only a machine can do, so it goes
   * on the queue and this waits for the answer. */
  if (asked === DO_TOOL.name) {
    const goal = String((args && args.goal) || '').trim();
    if (!goal) return say('What should it do? Pass the errand as `goal`, in a sentence.', true);
    return queueAndWait(sql, who, {
      flowId: BROWSER_GOAL, toolName: asked, args: { goal: goal.slice(0, 2000) },
    });
  }

  if (AGENT_JOBS[asked]) {
    return queueAndWait(sql, who, { flowId: AGENT_JOBS[asked], toolName: asked, args });
  }

  if (asked !== RUN_TOOL.name) {
    return say(`There is no tool called "${asked}". Ask for the tool list again; skills are run through `
      + `${RUN_TOOL.name} rather than each having a tool of its own.`, true);
  }

  /* КЕЙС ЗАПУСКАЕТСЯ ЭТИМ ЖЕ ТУЛОМ, тем же путём и с теми же отказами: «прогони это сейчас» - одна просьба,
   * и то, что в одном случае к цели дописываются проверки, не делает её другой. Значения параметров и
   * утверждения читает драйвер из строки кейса при старте; в работе едет только указатель. */
  const askedCase = String((args && args.case) || '').trim();
  if (askedCase) {
    const found = await sql`
      select id, name, flow_id, expects from user_case
      where id = ${askedCase} and user_id = ${who.id} and deleted_at is null
    `.catch(() => []);
    if (!found.length) {
      return say(`There is no case "${askedCase}" on this account. Ask mouseflow_cases for what there is.`,
        true);
    }
    if (!Array.isArray(found[0].expects) || !found[0].expects.length) {
      return say('That case has no checks, so there is nothing it could prove. Add what must be true when '
        + 'the run is done.', true);
    }
    return queueAndWait(sql, who, {
      flowId: found[0].flow_id,
      /* Имя работы - имя кейса: на Activity читают «Outlook still sends», а не имя тула. */
      toolName: `case:${found[0].name}`.slice(0, 80),
      args: { [CASE_KEY]: { id: found[0].id } },
    });
  }

  const wanted = String((args && args.skill) || '').trim();
  if (!wanted) {
    return say('Which skill? Pass the id from mouseflow_recordings as `skill` - or a case id as `case`.',
      true);
  }
  /* The skill's own arguments live one level in, under `arguments`. A separate name rather than reassigning
   * `args`, which is a const and was exactly the mistake here - and one that only shows up when the tool is
   * actually called, since nothing else in this file reads that property. */
  const skillArgs = (args && typeof args.arguments === 'object' && args.arguments) || {};

  const { skills } = await skillsOf(sql, who.id);
  /* By id first, because that is what mouseflow_recordings prints and it cannot be ambiguous. A name is
   * accepted too, since it is what a person says out loud - but only when exactly one skill has it: two
   * skills sharing a name is legal, and picking one of them silently would run the wrong errand. */
  let entry = null;
  /* `.id`, which is what skillsOf() calls it - it renames client_id on the way out. Reading `client_id`
   * here found nothing, ever, and looked exactly like a deleted skill. */
  for (const flow of skills) if (flow.id === wanted) entry = { flow, structure: structureOf(flow) };
  if (!entry) {
    const named = skills.filter((f) => String(f.name || '').trim() === wanted);
    if (named.length > 1) {
      return say(`${named.length} skills are called "${wanted}". Pass one of these ids instead: `
        + `${named.map((f) => f.id).join(', ')}.`, true);
    }
    if (named.length === 1) entry = { flow: named[0], structure: structureOf(named[0]) };
  }
  if (!entry) {
    return say(`There is no skill "${wanted}" on this account. Ask mouseflow_recordings for what there is; `
      + 'it names each skill\'s id and the inputs it takes.', true);
  }
  /* Раньше здесь стоял отказ: «спросите пользователя запустить это в расширении». Он был верен, пока
   * расширение не умело брать работу с аккаунта, - а теперь умеет, и очередь развозит по поверхностям
   * (см. claimerIsBrowser в workerRoute). Отказывать стало нечему: строка встанет в очередь и её заберёт
   * тот Chrome, в котором это включено, а если такого нет - ожидание кончится и об этом скажут прямо,
   * что и есть разница между «никто не подобрал» и «мы не стали и пробовать». */
  /* The tool name on the row stays the SKILL's, not `mouseflow_run` - it is what "MouseFlow is already busy
   * on that machine (…)" names, and "busy on mouseflow_run" would tell nobody which errand is in progress. */
  return queueAndWait(sql, who, {
    flowId: entry.flow.id, toolName: entry.structure.toolName, args: skillArgs,
  });
}

/* Put it on the queue and wait for the machine.
 *
 * One path for a skill and for the timer, because the difference between them is what the worker does with
 * the row, not how it gets there. Waiting rather than returning an id is the point: a tool that comes back
 * before the work happened has told the caller nothing, and the answer says plainly when the wait ran out
 * rather than reporting a success nobody saw. */
async function queueAndWait(sql, who, { flowId, toolName, args }) {
  /* Обе проверки и оба отказа - в общей двери: страница тестов ставит работу тем же способом и обязана
   * отказывать теми же словами. Здесь остаётся только то, чего у страницы нет, - ожидание результата. */
  const put = await queueOne(sql, who.id, { flowId, toolName, args });
  if (put.why) return say(put.why, true);
  const id = put.id;

  const until = Date.now() + CALL_WAIT_MS;
  while (Date.now() < until) {
    await new Promise((done) => setTimeout(done, CALL_POLL_MS));
    const rows = await sql`select state, ok, said from run_queue where id = ${id}`;
    if (!rows.length) break;
    const job = rows[0];
    if (job.state === 'done' || job.state === 'failed' || job.state === 'cancelled') {
      return say(job.said || (job.ok ? 'Done.' : 'It did not finish.'), !job.ok);
    }
  }

  const now = await sql`select state from run_queue where id = ${id}`;
  const state = now.length ? now[0].state : 'gone';
  return say(state === 'queued'
    ? `Nothing on the machine picked this up within ${Math.round(CALL_WAIT_MS / 1000)} seconds, and it is `
      + `still queued as ${id}. The MouseFlow worker is probably not running there. Call `
      + `mouseflow_run_status with that id, or mouseflow_stop to take it off the queue.`
    : `It is still running on the machine as ${id}. Call mouseflow_run_status with that id for the outcome.`,
  state === 'queued');
}


