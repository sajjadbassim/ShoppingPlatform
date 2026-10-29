import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@wasit/ui';
import { Screen, Segmented } from '../components/kit';
import { AccountsTab } from '../components/social/AccountsTab';
import { FeedTab } from '../components/social/FeedTab';
import { PostsTab } from '../components/social/PostsTab';

type Tab = 'accounts' | 'feed' | 'posts';
const TABS: Tab[] = ['accounts', 'feed', 'posts'];
const KEYS = ['v-social', 'v-feed', 'v-social-posts'];

// شاشة واحدة لكل ما يخص حسابات التواصل: الربط، ما نُشر سابقاً على الحسابات، وسجل منشورات المنصة (المجدولة والفاشلة).
// عودة المتصفح من موافقة المنصة تصل إلى هذه الشاشة (wasit-seller://social?platform&code&state) فنفتح تبويب الحسابات ليكمل الربط
export default function SocialScreen() {
  useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ tab?: string; platform?: string; state?: string; error?: string }>();
  const returning = !!params.platform && (!!params.state || !!params.error);
  const [tab, setTab] = useState<Tab>(returning ? 'accounts' : TABS.includes(params.tab as Tab) ? (params.tab as Tab) : 'accounts');

  useEffect(() => { if (returning) setTab('accounts'); }, [returning, params.state, params.error]);
  useEffect(() => { if (TABS.includes(params.tab as Tab)) setTab(params.tab as Tab); }, [params.tab]);

  const fetching = useIsFetching({ predicate: (q) => KEYS.includes(String(q.queryKey[0])) }) > 0;
  const refresh = () => KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  return (
    <Screen title="ربط الحسابات والنشر" subtitle="إنستغرام وفيسبوك وتيك توك" back refreshing={fetching} onRefresh={refresh}>
      <Segmented<Tab>
        value={tab}
        onChange={(t) => { setTab(t); router.setParams({ tab: t }); }}
        options={[{ key: 'accounts', label: 'الحسابات' }, { key: 'feed', label: 'المنشورات' }, { key: 'posts', label: 'السجل' }]}
      />
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'feed' && <FeedTab />}
      {tab === 'posts' && <PostsTab />}
    </Screen>
  );
}
