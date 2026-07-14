import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { beijingISO } from "../utils/dateUtils";

const PUSHPLUS_TOKEN_KEY = "imau_pushplus_token";

export default function useSettings(user) {
  const [pushplusToken, setPushplusTokenRaw] = useState(() =>
    localStorage.getItem(PUSHPLUS_TOKEN_KEY) || ""
  );
  const [remindBefore, setRemindBefore] = useState(30); // 提前多少分钟提醒

  // 缓存 token 到 localStorage
  const setPushplusToken = useCallback((token) => {
    setPushplusTokenRaw(token);
    if (token) {
      localStorage.setItem(PUSHPLUS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(PUSHPLUS_TOKEN_KEY);
    }
  }, []);

  // 从 Supabase 加载设置
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("pushplus_token, remind_before")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Failed to load user settings:", error.message);
        return;
      }
      if (data) {
        if (data.pushplus_token) {
          setPushplusTokenRaw(data.pushplus_token);
          localStorage.setItem(PUSHPLUS_TOKEN_KEY, data.pushplus_token);
        }
        if (data.remind_before != null) {
          setRemindBefore(data.remind_before);
        }
      }
    };
    load();
  }, [user]);

  // 同步 token 到 Supabase
  useEffect(() => {
    if (!user) return;
    const save = async () => {
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          pushplus_token: pushplusToken,
          remind_before: remindBefore,
          updated_at: beijingISO(),
        },
        { onConflict: "user_id" }
      );
      if (error) {
        console.error("保存 PushPlus Token 失败:", error.message, error.details, error.hint);
      } else {
        console.log("PushPlus Token 已保存到 Supabase, user_id:", user.id, "token:", pushplusToken ? pushplusToken.slice(0,6)+"..." : "(空)");
      }
    };
    // 防抖：等用户停止输入 1 秒后再保存
    const timer = setTimeout(save, 1000);
    return () => clearTimeout(timer);
  }, [pushplusToken, remindBefore, user]);

  return { pushplusToken, setPushplusToken, remindBefore, setRemindBefore };
}

// 独立工具函数：发送一条微信提醒（可在任何地方调用）
export async function sendPushPlus(token, title, content) {
  if (!token) throw new Error("未配置 PushPlus Token");

  const resp = await fetch("/api/remind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      title: `🔔 ${title}`,
      content: content || title,
      template: "html",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || data.code !== 200) {
    throw new Error(data.msg || data.error || "推送失败");
  }
  return data;
}
