"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { Team, UserListItem, UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const roleOptions: UserRole[] = [
  "admin",
  "project_manager",
  "team_lead",
  "developer",
  "viewer",
];

type UserFormState = {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  teamId: string;
  isActive: boolean;
};

function emptyForm(): UserFormState {
  return {
    username: "",
    email: "",
    password: "",
    role: "developer",
    teamId: "",
    isActive: true,
  };
}

function userToForm(user: UserListItem): UserFormState {
  return {
    username: user.username,
    email: user.email,
    password: "",
    role: user.role,
    teamId: user.teamId ? String(user.teamId) : "",
    isActive: user.isActive,
  };
}

type UsersAdminPanelProps = {
  teams: Team[];
  onError: (msg: string) => void;
};

function UserFormFields({
  form,
  setForm,
  isEdit,
  teams,
}: {
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  isEdit: boolean;
  teams: Team[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm text-warm-muted md:col-span-2">
        Имя пользователя
        <Input
          className="mt-1"
          value={form.username}
          onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
          required
        />
      </label>
      <label className="text-sm text-warm-muted md:col-span-2">
        Email
        <Input
          type="email"
          className="mt-1"
          value={form.email}
          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
          required
        />
      </label>
      <label className="text-sm text-warm-muted md:col-span-2">
        {isEdit ? "Новый пароль (необязательно)" : "Пароль"}
        <Input
          type="password"
          className="mt-1"
          value={form.password}
          onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
          placeholder={isEdit ? "Оставьте пустым, чтобы не менять" : ""}
          required={!isEdit}
          minLength={isEdit ? undefined : 6}
        />
      </label>
      <label className="text-sm text-warm-muted">
        Роль
        <Select
          value={form.role}
          onValueChange={(v) => setForm((p) => ({ ...p, role: v as UserRole }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="text-sm text-warm-muted">
        Команда
        <Select
          value={form.teamId || "__none__"}
          onValueChange={(v) => setForm((p) => ({ ...p, teamId: v === "__none__" ? "" : v }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Команда" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Без команды</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="flex items-center gap-2 text-sm text-warm-muted md:col-span-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
          className="h-4 w-4 rounded border-border-soft"
        />
        Активный пользователь
      </label>
      {form.role ? (
        <p className="text-xs text-warm-muted md:col-span-2">{ROLE_DESCRIPTIONS[form.role]}</p>
      ) : null}
    </div>
  );
}

export function UsersAdminPanel({ teams, onError }: UsersAdminPanelProps) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm);

  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [editForm, setEditForm] = useState<UserFormState>(emptyForm);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.getUsers();
      setUsers(res.data || []);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Не удалось загрузить пользователей");
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function openCreate() {
    setCreateForm(emptyForm());
    setShowCreate(true);
  }

  function openEdit(user: UserListItem) {
    setEditingUser(user);
    setEditForm(userToForm(user));
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateForm(emptyForm());
  }

  function closeEdit() {
    setEditingUser(null);
    setEditForm(emptyForm());
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.createUser({
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        teamId: createForm.teamId ? Number(createForm.teamId) : null,
        isActive: createForm.isActive,
      });
      closeCreate();
      await loadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не удалось создать пользователя");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const payload: Parameters<typeof api.updateUser>[1] = {
        username: editForm.username.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        teamId: editForm.teamId ? Number(editForm.teamId) : null,
        isActive: editForm.isActive,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password;
      }
      await api.updateUser(editingUser.id, payload);
      closeEdit();
      await loadUsers();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не удалось сохранить пользователя");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleActive(user: UserListItem) {
    try {
      await api.updateUser(user.id, { isActive: !user.isActive });
      await loadUsers();
      if (editingUser?.id === user.id) {
        setEditForm((p) => ({ ...p, isActive: !user.isActive }));
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Не удалось обновить статус");
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Управление пользователями</CardTitle>
          <CardDescription>
            Создание и редактирование учётных записей, назначение ролей и команд.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={openCreate}>
              + Пользователь
            </Button>
            <Button size="sm" variant="outline" onClick={loadUsers} disabled={isLoading}>
              {isLoading ? "Загрузка…" : "Обновить"}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-border-soft/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && !isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-warm-muted">
                      Нет пользователей
                    </TableCell>
                  </TableRow>
                ) : null}
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-warm-muted">{user.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{ROLE_LABELS[user.role]}</TableCell>
                    <TableCell className="text-sm">{user.team?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "secondary" : "outline"}>
                        {user.isActive ? "Активен" : "Заблокирован"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openEdit(user)}
                        >
                          Изменить
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => toggleActive(user)}
                        >
                          {user.isActive ? "Блок." : "Акт."}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {}
      <Dialog open={showCreate} onOpenChange={(open) => !open && closeCreate()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый пользователь</DialogTitle>
            <DialogDescription>
              Заполните данные учётной записи. Пароль будет использоваться при входе в систему.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <UserFormFields form={createForm} setForm={setCreateForm} isEdit={false} teams={teams} />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCreate} disabled={isSaving}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Создание…" : "Создать"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {}
      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open) closeEdit();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактирование пользователя</DialogTitle>
            <DialogDescription>
              {editingUser
                ? `ID ${editingUser.id} · измените данные и нажмите «Сохранить»`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <UserFormFields form={editForm} setForm={setEditForm} isEdit teams={teams} />
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEdit} disabled={isSaving}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
