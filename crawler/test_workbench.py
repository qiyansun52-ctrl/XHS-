import asyncio
import unittest

from agent.conversation_store import ConversationStore


class FakeResult:
    def __init__(self, data=None):
        self.data = data


class FakeTable:
    def __init__(self, name, client):
        self.name = name
        self.client = client
        self.calls = []
        self.insert_payload = None
        self.update_payload = None

    def insert(self, payload):
        self.calls.append(("insert", payload))
        self.insert_payload = payload
        return self

    def select(self, columns):
        self.calls.append(("select", columns))
        return self

    def eq(self, column, value):
        self.calls.append(("eq", column, value))
        return self

    def order(self, column, desc=False):
        self.calls.append(("order", column, desc))
        return self

    def limit(self, count):
        self.calls.append(("limit", count))
        return self

    def maybe_single(self):
        self.calls.append(("maybe_single",))
        return self

    def update(self, payload):
        self.calls.append(("update", payload))
        self.update_payload = payload
        return self

    def execute(self):
        self.calls.append(("execute",))
        if self.insert_payload is not None:
            self.client.inserts.append((self.name, self.insert_payload))
            return FakeResult(self.insert_payload)
        if self.update_payload is not None:
            self.client.updates.append((self.name, self.update_payload))
            return FakeResult([self.update_payload])
        return FakeResult(self.client.responses.get(self.name, []))


class FakeSupabase:
    def __init__(self, responses=None):
        self.responses = responses or {}
        self.tables = []
        self.inserts = []
        self.updates = []

    def table(self, name):
        table = FakeTable(name, self)
        self.tables.append(table)
        return table


class ConversationStoreTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_conversation_add_message_and_read_snapshot(self):
        store = ConversationStore()

        conversation = await store.create_conversation(
            title="英国素材调研",
            member_id="member-1",
        )
        message = await store.add_message(
            conversation_id=conversation["id"],
            role="user",
            message_type="text",
            content="帮我找英国方面的素材",
            payload={"source": "manual"},
        )
        snapshot = await store.get_conversation_snapshot(conversation["id"])

        self.assertEqual(conversation["title"], "英国素材调研")
        self.assertEqual(message["content"], "帮我找英国方面的素材")
        self.assertEqual(snapshot["conversation"]["id"], conversation["id"])
        self.assertEqual(snapshot["messages"][0]["id"], message["id"])

    async def test_list_conversations_orders_newest_first(self):
        store = ConversationStore()
        first = await store.create_conversation(title="first")
        second = await store.create_conversation(title="second")

        rows = await store.list_conversations()

        self.assertEqual([row["id"] for row in rows], [second["id"], first["id"]])

    async def test_store_persists_to_supabase_when_client_is_present(self):
        sb = FakeSupabase()
        store = ConversationStore(sb)

        conversation = await store.create_conversation(title="英国素材")
        await store.add_message(conversation["id"], "assistant", "answer", "已生成 brief")

        table_names = [name for name, payload in sb.inserts]
        self.assertIn("ai_conversations", table_names)
        self.assertIn("ai_messages", table_names)
