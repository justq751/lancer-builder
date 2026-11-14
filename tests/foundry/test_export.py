import json
import pathlib
import sys
import unittest
from unittest.mock import patch

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

    def test_ui_uses_site_locales_and_rejects_unusable_translations(self):
        read_json = export.read_json
        replacement = {"en": "Main", "ru": "Проверка"}

        def changed_locale(path):
            data = read_json(path)
            if path.name == "enums.json":
                data["mount_types"]["Main"] = replacement
            return data

        with patch.object(export, "read_json", side_effect=changed_locale):
            self.assertEqual(export.build_ui()[1]["MAIN"], "ПРОВЕРКА")
            for invalid in [{"ru": ""}, {"ru": "Текст", "stale": True}, {"ru": "Текст {n}"}]:
                replacement = invalid
                with self.assertRaisesRegex(ValueError, "Foundry UI"):
                    export.build_ui()

    def test_ui_terms_match_site_sources(self):
        lang, labels = export.build_ui()
        stats = lang["lancer"]["common-sheet"]["shortStats"]
        stat_labels = export.read_json(export.ROOT / "locales/ru/stat_labels.json")
        ui = export.read_json(export.ROOT / "locales/ru/ui.json")
        self.assertEqual(stats["heatcap"], stat_labels["heatcap"]["ru"].upper())
        self.assertEqual(stats["HEAT CAP"], stats["heatcap"])
        self.assertEqual(stats["hp"], ui["term.stat.hp"]["ru"].upper())
        self.assertEqual(stats["HP"], stat_labels["hp"]["ru"].upper())
        self.assertEqual(labels["CORE SYSTEM"], ui["sheet.core_system"]["ru"].upper())

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
