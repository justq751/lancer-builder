import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "tools"))
import export_foundry_locale as export


class ExportTests(unittest.TestCase):
    def report(self):
        return {"skipped": [], "adapted": []}

    def test_empty_stale_and_changed_placeholder(self):
        report = self.report()
        self.assertIsNone(export.pair({"en": "x", "ru": ""}, "x", "test", report))
        self.assertIsNone(export.pair({"en": "x", "ru": "y", "stale": True}, "x", "test", report))
        self.assertEqual(report["skipped"], ["test: stale"])
        with self.assertRaisesRegex(ValueError, "placeholder"):
            export.pair({"en": "Burn {VAL}", "ru": "Огонь"}, "", "test", report)

    def test_adapted_prose_retains_both_known_english_forms(self):
        result = export.pair({"en": "base<br>action", "ru": "перевод"}, "base", "test", self.report())
        self.assertEqual(result["en"], ["base<br>action", "base"])

    def test_duplicate_nested_name_is_an_error(self):
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            export.named({}, [{"name": "same"}, {"name": "same"}], [], "test", self.report())

    def test_complete_export_is_deterministic_and_contains_no_mechanics(self):
        files, report = export.build()
        self.assertEqual(files, export.build()[0])
        self.assertEqual(report["entries"]["frames"], 55)
        self.assertEqual(report["entries"]["weapons"], 123)
        self.assertEqual(report["entries"]["statuses"], 16)
        forbidden = {"damage", "range", "bonuses", "license", "manufacturer", "curr_rank", "lid", "val", "changes"}

        def check(node):
            if not isinstance(node, dict):
                return
            self.assertFalse(forbidden.intersection(node))
            if "ru" in node:
                self.assertIsInstance(node["ru"], str)
                self.assertTrue(all(isinstance(s, str) for s in node["en"]))
                return
            for value in node.values():
                check(value)

        for name, content in files.items():
            if name.startswith("compendium/"):
                for entry in json.loads(content)["entries"].values():
                    check(entry)


if __name__ == "__main__":
    unittest.main()
