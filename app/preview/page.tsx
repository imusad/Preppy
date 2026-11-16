"use client";
// Design preview with sample data: /preview. Not linked from the app.
import PlanScreens from '@/components/plan/PlanScreens';
import { samplePlan } from '@/lib/fixtures/samplePlan';

export default function Preview() {
  return <div style={{ height: '100dvh' }}><PlanScreens plan={samplePlan} onEditSetup={() => alert('Edit setup')} onExported={() => {}} /></div>;
}
