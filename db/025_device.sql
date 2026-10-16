-- Машина - сущность на сервере (Hivelink, шаг H1; docs/HIVELINK-PLAN.md §3).
--
-- ПРИМЕНЕНА 2026-10-16, по разрешению владельца в чате («done» в ответ на «готово, применяй»), затем
-- проверена `npm run migrate -- --list` (25 файлов, все applied) и чтением information_schema: восемь
-- колонок и индекс run_queue_device на месте. Перед этим сверено, что development и production Vercel
-- смотрят в одну базу. Код, который её читает, написан так, что работает и БЕЗ неё (to_jsonb и
-- try/catch, как у 022) - это свойство стоит сохранить.
--
-- ПОЧЕМУ МАШИНА - ЭТО device_token, А НЕ НОВАЯ ТАБЛИЦА. У каждого привязанного агента уже свой токен, и
-- сервер узнаёт его на каждом запросе (api/_session.js, byDeviceToken). Отдельная таблица `machine` была бы
-- второй сущностью, которую пришлось бы сличать с первой, - ровно та беда, от которой 022 ушла к имени,
-- приезжающему в claim. Здесь сличать нечего: кто предъявил токен, тот и машина. Отозвать токен - значит
-- отключить машину, и это уже умеет Settings → My account.
--
-- ЧТО ДОБАВЛЯЕТСЯ И ОТКУДА ОНО БЕРЁТСЯ:
--   name           имя, которое человек дал машине на экране (Overview, затем Devices). Пусто - не давали.
--   hostname       то, что агент сам о себе сообщает в claim как `worker` (Environment.MachineName на
--                  Windows, Host.current().localizedName на macOS). Подсказка, а не идентичность.
--   platform       'windows' | 'macos', из отчёта агента; пусто, пока он не прислал.
--   agent_version  версия из того же отчёта (health.version).
--   seen_at        когда машина последний раз спрашивала работу. last_used_at обновляется на ЛЮБОМ запросе с
--                  токеном (и на отчёте, и на шаге), а «на связи» - это именно вопрос «есть ли работа».
alter table device_token add column if not exists name          text;
alter table device_token add column if not exists hostname      text;
alter table device_token add column if not exists platform      text;
alter table device_token add column if not exists agent_version text;
alter table device_token add column if not exists seen_at       timestamptz;
-- ПАУЗА МАШИНЫ ИЗ АККАУНТА (H2): сервер просто не выдаёт ей работу. Агент об этом не знает и знать не
-- должен - ему отвечают «работы нет», как на пустой очереди, - поэтому пауза работает на любой версии агента.
-- Выключатель в трее остаётся вторым и главным: его сервер не может отменить.
alter table device_token add column if not exists paused        boolean not null default false;

-- КТО ВЗЯЛ РАБОТУ - id токена, рядом с claimed_by (там остаётся присланное имя, его читают люди).
-- По нему ?worker=step|report|state отвечают только тому, кто работу взял, «занято» считается по машине,
-- а Overview - сколько сделала каждая. Привязка «на какой машине можно» по-прежнему run_queue.machine
-- (022): туда теперь пишется id устройства, а прежнее имя компьютера продолжает сличаться, как раньше.
alter table run_queue add column if not exists claimed_device text;

-- РАСПИСАНИЕ НА МАШИНЕ (H2): id устройства или NULL - на любой свободной. Работа, которую ставит такт
-- расписания, несёт его в run_queue.machine.
alter table user_schedule add column if not exists machine text;

-- Счёт по машинам за окно: «сколько сделала эта машина» - по claimed_device среди работ аккаунта.
create index if not exists run_queue_device on run_queue (user_id, claimed_device, created_at desc);
