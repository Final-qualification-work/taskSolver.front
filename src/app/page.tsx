import TeamBalancerApp from "@/components/team-balancer-app";
import AuthGuard from "@/components/auth-guard";

export default function Home() {
  return (
    <AuthGuard>
      <TeamBalancerApp />
    </AuthGuard>
  );
}
