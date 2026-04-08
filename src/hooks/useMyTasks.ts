/**
 * useMyTasks Hook
 *
 * Production rule: tasks must be derived from canonical sources.
 * No hardcoded mock data. Return empty arrays if no data exists.
 */

import { useMemo } from "react";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useAuth } from "@/contexts/AuthContext";

export interface MaintenanceTask {
  id: string;
  aircraft: string;
  flightCode: string;
  flightDate: string;
  title: string;
  technicalDescription: string;
  severity: "critical" | "medium" | "low";
  requiredRank: "technician" | "maintenance-chief" | "commander";
  system: string;
  status: string;
  isMyResponsibility: boolean;
  assignedTo?: string;
  findingId?: string;
}

interface TaskStats {
  completedThisWeek: number;
  escalatedThisWeek: number;
  awaitingParts: number;
}

interface MyTasksResult {
  myPendingTasks: MaintenanceTask[];
  waitingForOthers: MaintenanceTask[];
  weeklyStats: TaskStats;
  isEmpty: boolean;
  hasMyTasks: boolean;
  hasWaitingTasks: boolean;
  isLoading: boolean;
}

const mapSeverity = (severity: string): "critical" | "medium" | "low" => {
  switch (severity) {
    case "S1":
      return "critical";
    case "S2":
      return "medium";
    case "S3":
    case "S4":
    default:
      return "low";
  }
};

const mapRequiredRank = (role: string | undefined): "technician" | "maintenance-chief" | "commander" => {
  switch (role) {
    case "commander":
      return "commander";
    case "engineer":
    case "specialist":
      return "maintenance-chief";
    default:
      return "technician";
  }
};

const mapStatusToHebrew = (status: string): string => {
  const statusMap: Record<string, string> = {
    open: "ממתין לטיפול",
    in_progress: "בטיפול",
    pending_parts: "ממתין לחלקים",
    pending_approval: "ממתין לאישור רמ״ד",
    completed: "הושלם",
    cancelled: "בוטל",
  };
  return statusMap[status] || status;
};

export const useMyTasks = (): MyTasksResult => {
  const { user } = useAuth();
  const { tasks, findings } = useFlightDossier();

  const userId = user?.id || "";

  const myPendingTasks = useMemo((): MaintenanceTask[] => {
    if (!userId) return [];

    const assignedTasks = tasks.filter((task) => task.assignedTo === userId && task.status !== "completed");

    return assignedTasks.map((task) => {
      const finding = findings.find((item) => item.id === task.findingId);

      return {
        id: task.id,
        aircraft: task.tailNumbers?.[0] || "N/A",
        flightCode: task.dossierIds?.[0] || task.id,
        flightDate: task.createdAt?.split("T")[0] || "",
        title: task.titleHe || task.title || "משימה",
        technicalDescription: task.descriptionHe || task.description || "",
        severity: finding ? mapSeverity(finding.severity) : "medium",
        requiredRank: mapRequiredRank(task.assignedRole),
        system: finding?.systemAffectedHe || finding?.systemAffected || "כללי",
        status: mapStatusToHebrew(task.status),
        isMyResponsibility: true,
        findingId: task.findingId,
      };
    });
  }, [findings, tasks, userId]);

  const waitingForOthers = useMemo((): MaintenanceTask[] => {
    if (!userId) return [];

    // Scope to findings that are relevant to the current user:
    // tasks that share a findingId with one of my assigned tasks, or are on the same aircraft.
    const myFindingIds = new Set(
      tasks
        .filter((t) => t.assignedTo === userId)
        .map((t) => t.findingId)
        .filter(Boolean)
    );
    const myTailNumbers = new Set(
      tasks
        .filter((t) => t.assignedTo === userId)
        .flatMap((t) => t.tailNumbers ?? [])
    );

    const othersTasks = tasks.filter(
      (task) =>
        task.assignedTo !== userId &&
        task.status !== "completed" &&
        task.status !== "cancelled" &&
        (
          (task.findingId != null && myFindingIds.has(task.findingId)) ||
          (task.tailNumbers?.some((n) => myTailNumbers.has(n)) ?? false)
        )
    );

    return othersTasks.map((task) => {
      const finding = findings.find((item) => item.id === task.findingId);

      return {
        id: task.id,
        aircraft: task.tailNumbers?.[0] || "N/A",
        flightCode: task.dossierIds?.[0] || task.id,
        flightDate: task.createdAt?.split("T")[0] || "",
        title: task.titleHe || task.title || "משימה",
        technicalDescription: task.descriptionHe || task.description || "",
        severity: finding ? mapSeverity(finding.severity) : "medium",
        requiredRank: mapRequiredRank(task.assignedRole),
        system: finding?.systemAffectedHe || finding?.systemAffected || "כללי",
        status: mapStatusToHebrew(task.status),
        isMyResponsibility: false,
        assignedTo: task.assignedTo || "לא הוקצה",
        findingId: task.findingId,
      };
    });
  }, [findings, tasks, userId]);

  const weeklyStats = useMemo((): TaskStats => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    const completedThisWeek = tasks.filter(
      (task) => task.status === "completed" && task.updatedAt && task.updatedAt >= oneWeekAgoStr
    ).length;

    const escalatedThisWeek = tasks.filter(
      (task) => task.status === "pending_approval" && task.updatedAt && task.updatedAt >= oneWeekAgoStr
    ).length;

    const awaitingParts = tasks.filter((task) => task.status === "pending_parts").length;

    return {
      completedThisWeek,
      escalatedThisWeek,
      awaitingParts,
    };
  }, [tasks]);

  const hasMyTasks = myPendingTasks.length > 0;
  const hasWaitingTasks = waitingForOthers.length > 0;
  const isEmpty = !hasMyTasks && !hasWaitingTasks;

  return {
    myPendingTasks,
    waitingForOthers,
    weeklyStats,
    isEmpty,
    hasMyTasks,
    hasWaitingTasks,
    isLoading: false,
  };
};

export default useMyTasks;
