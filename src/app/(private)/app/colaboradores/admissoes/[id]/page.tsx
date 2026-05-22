import { LifecycleChecklistDetailPage } from "@/features/lifecycle/detail-page-content";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OnboardingDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <LifecycleChecklistDetailPage id={id} type="onboarding" />;
}
