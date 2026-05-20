"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PersonalizedRecommendation, TagType, Team, UserPreferences } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SimpleBarChart } from "@/components/simple-bar-chart";

const tagOptions: TagType[] = ["frontend", "backend", "ML"];

type PreferencesPanelProps = {
  teams: Team[];
  onError: (msg: string) => void;
};

export function PreferencesPanel({ teams, onError }: PreferencesPanelProps) {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [recommendation, setRecommendation] = useState<PersonalizedRecommendation | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRec, setIsLoadingRec] = useState(false);

  const [weightCost, setWeightCost] = useState(33);
  const [weightLoad, setWeightLoad] = useState(33);
  const [weightPreference, setWeightPreference] = useState(34);
  const [preferredTeamIds, setPreferredTeamIds] = useState<number[]>([]);
  const [preferredTags, setPreferredTags] = useState<TagType[]>([]);

  useEffect(() => {
    api
      .getPreferences()
      .then((res) => {
        const p = res.data;
        setPrefs(p);
        setWeightCost(Math.round(p.weightCost * 100));
        setWeightLoad(Math.round(p.weightLoad * 100));
        setWeightPreference(Math.round(p.weightPreference * 100));
        setPreferredTeamIds(p.preferredTeamIds || []);
        setPreferredTags(p.preferredTags || []);
      })
      .catch((e) => onError(e instanceof Error ? e.message : "Не удалось загрузить предпочтения"));
  }, [onError]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const sum = weightCost + weightLoad + weightPreference;
    if (sum === 0) {
      onError("Сумма весов не может быть 0");
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.updatePreferences({
        weightCost: weightCost / sum,
        weightLoad: weightLoad / sum,
        weightPreference: weightPreference / sum,
        preferredTeamIds,
        preferredTags,
      });
      setPrefs(res.data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось сохранить предпочтения");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadRecommendation() {
    setIsLoadingRec(true);
    setRecommendation(null);
    try {
      const res = await api.getPersonalizedRecommendations();
      setRecommendation(res.data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось получить рекомендацию");
    } finally {
      setIsLoadingRec(false);
    }
  }

  function toggleTeam(id: number) {
    setPreferredTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleTag(tag: TagType) {
    setPreferredTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }

  const teamLoadItems =
    recommendation?.recommendedSolution?.teamLoads &&
    teams.map((team) => {
      const load = recommendation.recommendedSolution.teamLoads[String(team.id)] ?? 0;
      const pct = team.capacity ? (load / team.capacity) * 100 : 0;
      return {
        label: team.name,
        value: Math.round(pct),
        hint: `${load}/${team.capacity} SP`,
      };
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Веса оптимизации</CardTitle>
          <CardDescription>
            PUT /visualization/preferences — стоимость, загрузка, предпочтительность (γ)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {[
              ["Стоимость (α)", weightCost, setWeightCost],
              ["Загрузка (β)", weightLoad, setWeightLoad],
              ["Предпочтительность (γ)", weightPreference, setWeightPreference],
            ].map(([label, val, setter]) => (
              <label key={label as string} className="block text-sm">
                <span className="text-warm-muted">
                  {label as string}: {val as number}%
                </span>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  className="mt-1"
                  value={val as number}
                  onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                />
              </label>
            ))}

            <div>
              <p className="mb-2 text-sm text-warm-muted">Предпочтительные команды</p>
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    size="sm"
                    variant={preferredTeamIds.includes(t.id) ? "secondary" : "outline"}
                    onClick={() => toggleTeam(t.id)}
                  >
                    {t.name}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-warm-muted">Предпочтительные теги</p>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    size="sm"
                    variant={preferredTags.includes(tag) ? "secondary" : "outline"}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Сохранение…" : "Сохранить предпочтения"}
              </Button>
              <Button type="button" variant="secondary" onClick={loadRecommendation} disabled={isLoadingRec}>
                {isLoadingRec ? "Расчёт…" : "Рекомендация по предпочтениям"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {recommendation && teamLoadItems && teamLoadItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Персонализированное распределение</CardTitle>
            <CardDescription>
              GET /visualization/recommendations · α={recommendation.userWeights.alpha.toFixed(2)} β=
              {recommendation.userWeights.beta.toFixed(2)} γ=
              {recommendation.userWeights.gamma.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SimpleBarChart items={teamLoadItems} valueSuffix="%" maxValue={100} />
            {recommendation.recommendedSolution.allTasksAssigned === false && (
              <p className="text-xs text-amber-700">Не все задачи удалось назначить с текущими ограничениями.</p>
            )}
          </CardContent>
        </Card>
      )}

      {prefs && (
        <p className="text-xs text-warm-muted">
          Порог загрузки: {(prefs.maxLoadThreshold * 100).toFixed(0)}% · мин. предпочтение:{" "}
          {prefs.minPreferenceThreshold}
        </p>
      )}
    </div>
  );
}
