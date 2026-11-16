'use client';

import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Activity, Chart, Goal, Person, Pregnancy, Sex } from '@/lib/types';
import { ACTIVITIES, CONDITIONS, GOALS, PREGNANCY, REGIONS, SEXES } from '@/lib/data/catalog';
import { chartFromBody, chartFromPhoto, readChart } from '@/lib/client/api';
import {
  UNREADABLE_MESSAGE, UPLOAD_ACCEPT, acceptedLine, chartView, draftMissing, isChartFile, photoUnusableMessage,
  readDraft, sourceLine, summaryLines, toBodyDetails, toPhotoDetails,
} from './chart';
import type { ChartDraft, DraftField } from './chart';
import { BodyIcon, CheckIcon, DocIcon, UploadIcon, WarnIcon } from './icons';
import { Field, Group, Tiles, cx } from './parts';
import { toggleWithNone } from './validate';
import s from './Setup.module.css';

/**
 * Photos picked for the photo path, by person id. A File cannot go in `chartDraft`
 * (it must stay plain JSON), so it is held here: it survives a remount, not a page reload.
 */
const photoFiles = new Map<string, File>();

const opts = (list: readonly string[]) => list.map((v) => ({ key: v, label: v, grey: v === 'None' || v === 'Neither' }));
const SEX_OPTS = opts(SEXES);
const REGION_OPTS = opts(REGIONS);
const ACTIVITY_OPTS = opts(ACTIVITIES);
const GOAL_OPTS = opts(GOALS);
const PREGNANCY_OPTS = opts(PREGNANCY);
const CONDITION_OPTS = opts(CONDITIONS);

const RETRY_MESSAGE = "We couldn't create the diet chart. Check your connection and try again. Your answers are kept.";

export default function ChartPanel(props: {
  person: Person;
  anchor: string;
  /** Highlight the whole question as missing (after Generate was tapped). */
  missing: boolean;
  onPatch: (fn: (p: Person) => Person) => void;
  onAccepted: () => void;
}) {
  const { person, onPatch } = props;
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [netError, setNetError] = useState<string | null>(null);

  const draft = readDraft(person);
  const view = chartView(person);
  const chart = person.chart;
  const hasPhoto = draft.photoName !== null && photoFiles.has(person.id);
  const gaps: Set<DraftField> = draft.tried ? draftMissing(draft, hasPhoto) : new Set();

  const setDraft = (patch: Partial<ChartDraft>) =>
    onPatch((p) => ({ ...p, chartDraft: { ...readDraft(p), ...patch } }));
  /** Leaving review or acceptance: the chart is dropped and must be accepted again. */
  const reopen = (patch: Partial<ChartDraft>) =>
    onPatch((p) => ({ ...p, chart: null, chartAccepted: false, chartDraft: { ...readDraft(p), ...patch } }));
  const toReview = (c: Chart) =>
    onPatch((p) => ({ ...p, chart: c, chartAccepted: false, chartDraft: { ...readDraft(p), step: 'review', tried: false, photoError: null } }));

  const toBody = () => { setNetError(null); reopen({ step: 'create', sub: 'body', tried: false, photoError: null }); };
  const toPhoto = () => { setNetError(null); reopen({ step: 'create', sub: 'photo', tried: false }); };

  async function onChartFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isChartFile(file)) { reopen({ step: 'unreadable' }); return; }
    setBusy('Reading ' + file.name + '…');
    try {
      const res = await readChart(file);
      if (res.status === 'ok') toReview({ ...res.chart, fileName: res.chart.fileName ?? file.name });
      else reopen({ step: 'unreadable' });
    } catch {
      reopen({ step: 'unreadable' });
    } finally {
      setBusy(null);
    }
  }

  function onPhotoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    photoFiles.set(person.id, file);
    setDraft({ photoName: file.name, photoError: null });
  }

  async function create() {
    setNetError(null);
    if (draftMissing(draft, hasPhoto).size > 0) { setDraft({ tried: true }); return; }
    try {
      if (draft.sub === 'body') {
        setBusy('Creating a diet chart…');
        const res = await chartFromBody(toBodyDetails(draft));
        toReview(res.chart);
      } else {
        setBusy('Estimating from your photo…');
        const res = await chartFromPhoto(photoFiles.get(person.id) as File, toPhotoDetails(draft));
        if (res.status === 'ok') {
          toReview(res.chart);
        } else {
          photoFiles.delete(person.id);
          setDraft({ photoName: null, photoError: res.reason, tried: false });
        }
      }
    } catch {
      setNetError(RETRY_MESSAGE);
    } finally {
      setBusy(null);
    }
  }

  function accept() {
    onPatch((p) => (p.chart ? { ...p, chartAccepted: true } : p));
    props.onAccepted();
  }

  function editFromReview() {
    if (chart?.source === 'upload') reopen({ step: 'upload' });
    else reopen({ step: 'create', sub: chart?.source === 'photo' ? 'photo' : 'body', tried: false });
  }

  const typed = (field: 'age' | 'heightCm' | 'weightKg', label: string, unit: string) => (
    <Field inputId={uid + field} label={label} unit={unit} missing={gaps.has(field)} req="Required">
      <input
        id={uid + field} type="number" inputMode="numeric" min={1} required aria-invalid={gaps.has(field) || undefined}
        value={draft[field]} onChange={(e) => setDraft({ [field]: e.target.value })}
      />
    </Field>
  );

  const icon = <BodyIcon size={20} />;

  return (
    <Group
      id={props.anchor} title="Diet chart" label="Diet chart" req="Add and accept a diet chart" missing={props.missing}
      aside={view === 'accepted' ? (
        <span className={cx(s.tag, s.tagSuccess)}><CheckIcon size={14} strokeWidth={2.4} />Chart accepted</span>
      ) : undefined}
    >
      <input
        ref={fileRef} type="file" hidden accept={UPLOAD_ACCEPT} onChange={onChartFile}
        aria-label="Diet chart file" tabIndex={-1}
      />
      <input
        ref={photoRef} type="file" hidden accept="image/*" onChange={onPhotoFile}
        aria-label="Full-length photo" tabIndex={-1}
      />

      <div role="status">
        {busy ? (
          <div className={s.reading}><span className={s.spin} aria-hidden="true" /><span>{busy}</span></div>
        ) : null}
      </div>

      {!busy && view === 'choose' ? (
        <div className={s.choices}>
          <button type="button" className={s.choice} onClick={() => setDraft({ step: 'upload' })}>
            <span className={cx(s.choiceIcon, s.choiceIconPrimary)}><UploadIcon size={20} /></span>
            <span className={s.choiceText}>
              <span className={s.choiceTitle}>Upload diet chart</span>
              <span className={s.choiceSub}>PDF or image from a dietitian or doctor</span>
            </span>
          </button>
          <button type="button" className={s.choice} onClick={() => setDraft({ step: 'create', sub: 'body' })}>
            <span className={cx(s.choiceIcon, s.choiceIconNeutral)}><DocIcon size={20} /></span>
            <span className={s.choiceText}>
              <span className={s.choiceTitle}>I don&apos;t have a diet chart</span>
              <span className={s.choiceSub}>We&apos;ll make one from body details or a photo</span>
            </span>
          </button>
        </div>
      ) : null}

      {!busy && view === 'upload' ? (
        <div className={s.dropBox}>
          <span className={s.dropTitle}>Choose a file</span>
          <span className={s.helper}>PDF, PNG, JPG, JPEG or HTML. Reading starts as soon as you pick it.</span>
          <button type="button" className={cx(s.btn, s.btnOutlined)} onClick={() => fileRef.current?.click()}>
            <UploadIcon size={18} />Choose diet chart file
          </button>
          <button type="button" className={cx(s.btn, s.btnText, s.btnStart)} onClick={() => setDraft({ step: 'choose' })}>Cancel</button>
        </div>
      ) : null}

      {!busy && view === 'unreadable' ? (
        <div role="alert" className={s.errorBox}>
          <span>{UNREADABLE_MESSAGE}</span>
          <div className={s.btnRow}>
            <button type="button" className={cx(s.btn, s.btnOutlined)} onClick={() => fileRef.current?.click()}>Upload again</button>
            <button type="button" className={cx(s.btn, s.btnText)} onClick={toBody}>Body details</button>
            <button type="button" className={cx(s.btn, s.btnText)} onClick={toPhoto}>Photo</button>
          </div>
        </div>
      ) : null}

      {!busy && view === 'create' ? (
        <div className={s.createForm}>
          <div className={s.seg} role="group" aria-label="How to create a diet chart">
            <button type="button" aria-pressed={draft.sub === 'body'} onClick={() => setDraft({ sub: 'body', tried: false })}>Enter body details</button>
            <button type="button" aria-pressed={draft.sub === 'photo'} onClick={() => setDraft({ sub: 'photo', tried: false })}>Upload a photo</button>
          </div>
          <p className={s.segHint}>
            {draft.sub === 'body'
              ? 'We work out a daily calorie target with a standard formula.'
              : 'The photo estimates body build only. Age, sex and region are asked, not guessed. The result is a rough estimate.'}
          </p>

          {draft.sub === 'photo' ? (
            <div className={s.photoBlock}>
              {draft.photoError ? (
                <div role="alert" className={s.errorBox}>
                  <span>{photoUnusableMessage(draft.photoError)}</span>
                  <button type="button" className={cx(s.btn, s.btnText, s.btnStart, s.btnFlush)} onClick={toBody}>Enter body details instead</button>
                </div>
              ) : null}
              {hasPhoto ? (
                <div className={s.photoReady}>
                  <span className={s.photoThumb}><BodyIcon size={22} strokeWidth={1.5} /></span>
                  <span className={s.photoReadyText}>
                    <span className={s.photoReadyName}>{draft.photoName} is ready</span>
                    <span className={s.photoReadySub}>Used only to make the chart, then deleted.</span>
                  </span>
                  <button type="button" className={cx(s.btn, s.btnText)} onClick={() => photoRef.current?.click()}>Change</button>
                </div>
              ) : (
                <Group title="Photo" label="Photo" small req="Add a photo" missing={gaps.has('photo')}
                  hint="A full-length photo of one person in good light.">
                  <button type="button" className={cx(s.btn, s.btnOutlined)} onClick={() => photoRef.current?.click()}>
                    <UploadIcon size={18} />Choose a photo
                  </button>
                </Group>
              )}
            </div>
          ) : null}

          <div className={s.grid3}>
            {typed('age', 'Age', 'yrs')}
            {draft.sub === 'body' ? typed('heightCm', 'Height', 'cm') : null}
            {draft.sub === 'body' ? typed('weightKg', 'Weight', 'kg') : null}
          </div>

          <Group title="Sex" label="Sex" small req="Pick one" missing={gaps.has('sex')}>
            <Tiles options={SEX_OPTS} size="s" icon={icon} isSelected={(k) => draft.sex === k}
              onPick={(k) => setDraft({ sex: k as Sex, pregnancy: k === 'Female' ? draft.pregnancy : null })} />
          </Group>
          {draft.sub === 'photo' ? (
            <Group title="Race or region" label="Race or region" small req="Pick one" missing={gaps.has('region')}>
              <Tiles options={REGION_OPTS} size="s" icon={icon} isSelected={(k) => draft.region === k} onPick={(k) => setDraft({ region: k })} />
            </Group>
          ) : (
            <Group title="Activity level" label="Activity level" small req="Pick one" missing={gaps.has('activity')}>
              <Tiles options={ACTIVITY_OPTS} size="s" icon={icon} isSelected={(k) => draft.activity === k} onPick={(k) => setDraft({ activity: k as Activity })} />
            </Group>
          )}
          <Group title="Goal" label="Goal" small req="Pick one" missing={gaps.has('goal')}>
            <Tiles options={GOAL_OPTS} size="s" icon={icon} isSelected={(k) => draft.goal === k} onPick={(k) => setDraft({ goal: k as Goal })} />
          </Group>
          {draft.sex === 'Female' ? (
            <Group title="Pregnant or breastfeeding?" label="Pregnant or breastfeeding" small req="Pick one" missing={gaps.has('pregnancy')}>
              <Tiles options={PREGNANCY_OPTS} size="s" icon={icon} isSelected={(k) => draft.pregnancy === k} onPick={(k) => setDraft({ pregnancy: k as Pregnancy })} />
            </Group>
          ) : null}
          <Group title="Medical conditions" label="Medical conditions" small req="Pick at least one, or None" missing={gaps.has('conditions')}>
            <Tiles options={CONDITION_OPTS} size="s" icon={icon} isSelected={(k) => draft.conditions.includes(k)}
              onPick={(k) => setDraft({ conditions: toggleWithNone(draft.conditions, k, 'None') })} />
          </Group>

          <div aria-live="assertive">
            {gaps.size > 0 ? (
              <span className={s.req}>{gaps.size === 1 ? '1 detail is missing.' : gaps.size + ' details are missing.'} Fill in the highlighted items to create the chart.</span>
            ) : null}
            {netError ? <div className={s.errorBox}><span>{netError}</span></div> : null}
          </div>
          <button type="button" className={cx(s.btn, s.btnFilled, s.btnTall)} onClick={create}>
            {netError ? 'Try again' : 'Create diet chart'}
          </button>
          <button type="button" className={cx(s.btn, s.btnText, s.btnStart)} onClick={() => setDraft({ step: 'choose', tried: false })}>Back to chart options</button>
        </div>
      ) : null}

      {!busy && view === 'review' && chart ? (
        <div className={s.review}>
          <div className={s.reviewHead}>
            <span className={s.reviewSource}>{sourceLine(chart)}</span>
            {chart.roughEstimate ? <span className={cx(s.tag, s.tagWarning)}>Rough estimate</span> : null}
          </div>
          <ul className={s.summaryList}>
            {summaryLines(chart).map((line) => (
              <li key={line.key} className={cx(s.summaryItem, line.unsure && s.summaryItemUnsure)}>
                <span className={s.summaryItemText}><span aria-hidden="true" className={s.bullet}>•</span>{line.text}</span>
                {line.unsure ? <span className={s.unsureText}>Please check this value</span> : null}
              </li>
            ))}
          </ul>
          {chart.advisory ? (
            <div role="note" className={s.advisory}><WarnIcon size={18} /><span>{chart.advisory}</span></div>
          ) : null}
          <p className={s.reviewHint}>Check this looks right. Recipes and portions follow this chart.</p>
          <div className={s.btnRow}>
            <button type="button" className={cx(s.btn, s.btnFilled, s.btnGrow)} onClick={accept}>Accept</button>
            <button type="button" className={cx(s.btn, s.btnOutlined, s.btnGrow)} onClick={editFromReview}>Edit</button>
          </div>
        </div>
      ) : null}

      {!busy && view === 'accepted' && chart ? (
        <div className={s.accepted}>
          <span className={s.acceptedLine}>{acceptedLine(chart)}</span>
          <span className={s.acceptedSource}>{sourceLine(chart)}</span>
          {chart.advisory ? <span className={s.acceptedAdvisory}>{chart.advisory}</span> : null}
          <button type="button" className={cx(s.btn, s.btnText, s.btnStart, s.btnFlush)} onClick={() => reopen({ step: 'choose', tried: false })}>Change chart</button>
        </div>
      ) : null}
    </Group>
  );
}
