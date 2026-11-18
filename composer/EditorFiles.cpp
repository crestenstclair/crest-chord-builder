#include "Editor.h"
using namespace juce;
namespace crest {
namespace {
File dragFile(const String &name) {
    auto dir = File::getSpecialLocation(File::tempDirectory).getChildFile("Crest Composer MIDI");
    auto ok = dir.createDirectory();
    if (ok.failed())
        throw std::runtime_error(ok.getErrorMessage().toStdString());
    return dir.getChildFile(File::createLegalFileName(name).substring(0, 60) + "-" +
                            Uuid().toString().substring(0, 12) + ".mid");
}
std::vector<uint8_t> readBytes(const File &f, int maxSize) {
    if (f.getSize() <= 0 || f.getSize() > maxSize)
        throw std::invalid_argument("File is empty or exceeds the size limit.");
    MemoryBlock data;
    if (!f.loadFileAsData(data) || data.getSize() > size_t(maxSize))
        throw std::runtime_error("Could not read file.");
    auto *begin = static_cast<const uint8_t *>(data.getData());
    return {begin, begin + data.getSize()};
}
void writeBytes(const File &f, const std::vector<uint8_t> &bytes) {
    if (!f.replaceWithData(bytes.data(), bytes.size()))
        throw std::runtime_error("Could not write MIDI file.");
}
} // namespace
void Editor::chooseFile(const String &caption, const String &filter, bool writing, const String &suggested,
                        std::function<void(const File &)> action) {
    auto dir = File::getSpecialLocation(File::userDocumentsDirectory);
    chooser = std::make_unique<FileChooser>(
        caption, suggested.isEmpty() ? dir : dir.getChildFile(File::createLegalFileName(suggested)), filter, true);
    auto flags = FileBrowserComponent::canSelectFiles |
                 (writing ? (FileBrowserComponent::saveMode | FileBrowserComponent::warnAboutOverwriting)
                          : FileBrowserComponent::openMode);
    chooser->launchAsync(flags, [self = Component::SafePointer<Editor>(this), gen = generation,
                                 action = std::move(action)](const FileChooser &picker) {
        if (!self)
            return;
        auto file = picker.getResult();
        if (file == File{})
            return;
        if (self->proc.revision() != gen) {
            self->message("Sketch changed while the file picker was open; try again.");
            return;
        }
        try {
            action(file);
        } catch (const std::exception &e) {
            self->message(e.what());
        }
    });
}
void Editor::saveMidi() {
    chooseFile("Save performed sketch", "*.mid", true, sketch().name + ".mid", [this](const File &file) {
        writeBytes(file, composer::performanceMidi(render(sketch(), proc.tempo(book), book.meter)));
        message("Saved " + file.getFullPathName());
    });
}
void Editor::dragMidi() {
    try {
        auto file = dragFile(sketch().name);
        writeBytes(file, composer::performanceMidi(render(sketch(), proc.tempo(book), book.meter)));
        if (DragAndDropContainer::performExternalDragDropOfFiles({file.getFullPathName()}, false, &drag))
            message("Drop the MIDI file on a Live MIDI track.");
        else
            message("The host did not start the drag. Use Save MIDI.");
    } catch (const std::exception &e) {
        message(e.what());
    }
}
void Editor::updateSendButton() {
    sendClips.setEnabled(TimelineSend::hasSketches(book) && !timeline.pending());
}
void Editor::sendSketchClips() {
    try {
        message(timeline.sendSketches(book, proc.tempo(book)));
    } catch (const std::exception &e) {
        message(e.what());
    }
    updateSendButton();
}
void Editor::importMotion() {
    chooseFile("Choose a MIDI performance template", "*.mid;*.midi", false, {},
               [this](const File &file) { applyMotion(file, file.getFileNameWithoutExtension(), false); });
}
void Editor::applyMotion(const File &file, const String &name, bool demo) {
    auto bytes = readBytes(file, maxTemplateBytes);
    composer::importPerformanceMidi(bytes);
    auto applied = sketch();
    applied.templateMidi = std::move(bytes);
    applied.templateName = name;
    applied.performance = "import";
    applied.perform = true;
    auto playable = applied;
    if (playable.slots.empty())
        playable.slots.push_back({candidate, 4});
    auto notes = render(playable, proc.tempo(book), book.meter);
    if (!demo) {
        sketch() = std::move(applied);
        if (!save()) return;
        closeBank();
    }
    // Preview an empty lane on a reference chord only when explicitly auditioning.
    if (demo || !sketch().slots.empty()) startLanePreview(notes, playable, sketch().slots.empty() ? -1 : book.active);
    else proc.audition.stop();
    message((demo ? "Audition: " : "Assigned: ") + name + "  /  " + sketch().name +
            (!demo && sketch().slots.empty() ? ". Add a chord to hear it." : ""));
}
void Editor::loadBank() {
    try {
        localBank = LocalBank::read(LocalBank::defaultFolder());
        palette.setBankColors(localBank->colors);
        if(book.colorSettings.isNotEmpty())palette.setSettings(JSON::parse(book.colorSettings));
    } catch (const std::exception &e) {
        message(e.what());
    }
}
void Editor::browseBank(bool progressions) {
    if (!localBank)
        loadBank();
    if (!localBank)
        return;
    if (!browser) {
        browser = std::make_unique<BankBrowser>(*localBank);
        addChildComponent(*browser);
        browser->onClose = [this] { closeBank(); };
        browser->onBlockChords = [this] {
            sketch().performance = "block";
            sketch().perform = true;
            if (!save()) return;
            closeBank();
            proc.audition.stop();
            message(sketch().name + "  /  Block chords");
        };
        browser->onMotion = [this](const BankMotion &m, bool demo) {
            try {
                applyMotion(m.midi, m.name, demo);
            } catch (const std::exception &e) {
                message(e.what());
            }
        };
        browser->onProgression = [this](const BankSet &set, bool demo) {
            try {
                auto applied = sketch();
                applied.slots.clear();
                for (auto &chord : set.transposeTo(applied.scale.tonic % 12))
                    applied.slots.push_back({chord, 4});
                if (demo)
                    startLanePreview(render(applied, proc.tempo(book), book.meter), applied, -1);
                else {
                    sketch() = std::move(applied);
                    slot = 0;
                    save();
                    selectSlot(0, false);
                    closeBank();
                }
                message(set.name);
            } catch (const std::exception &e) {
                message(e.what());
            }
        };
    }
    if (progressions)
        browser->showProgressions();
    else
        browser->showMotions(sketch().name, performanceName(sketch()));
    shade.setVisible(true);
    shade.toFront(false);
    browser->setVisible(true);
    browser->toFront(true);
    resized();
}
void Editor::closeBank() {
    if (browser)
        browser->setVisible(false);
    shade.setVisible(false);
}
void Editor::applyPart(const guitar::Part &part) {
    if (part.chords.size() > slotLimit)
        throw std::invalid_argument(
            "This part has more than eight chords; split it into shorter parts in Builder first.");
    auto m = std::find_if(modes().begin(), modes().end(), [&](auto &item) { return part.scale == item.guitarId; });
    if (m == modes().end())
        throw std::invalid_argument("This part uses a scale outside the Composer palette.");
    Sketch imported;
    imported.name = part.name;
    imported.scale = {48 + part.tonic, m->mode};
    for (const auto &c : part.chords) {
        auto pitches = c.notes;
        std::sort(pitches.begin(), pitches.end());
        pitches.erase(std::unique(pitches.begin(), pitches.end()), pitches.end());
        imported.slots.push_back({{c.name.toStdString(), 48 + c.root, std::move(pitches)}, 4});
    }
    sketch() = std::move(imported);
    slot = 0;
    save();
    selectSlot(0, false);
    message("Loaded guitar part: " + part.name);
}
void Editor::importGuitar() {
    chooseFile("Open Crest Chord Builder project", "*.json", false, {}, [this](const File &file) {
        auto bytes = readBytes(file, 2 * 1024 * 1024);
        auto parts =
            guitar::readProject(String::fromUTF8(reinterpret_cast<const char *>(bytes.data()), int(bytes.size())));
        if (parts.empty())
            throw std::invalid_argument("No guitar parts in project.");
        if (parts.size() == 1) {
            applyPart(parts.front());
            return;
        }
        PopupMenu list;
        for (int i = 0; i < int(parts.size()); ++i)
            list.addItem(i + 1, parts[i].name + "  (" + String(parts[i].chords.size()) + " chords)");
        list.showMenuAsync(
            PopupMenu::Options().withTargetComponent(&openGuitar),
            [self = Component::SafePointer<Editor>(this), gen = generation, parts = std::move(parts)](int id) {
                if (!self || !id || self->proc.revision() != gen)
                    return;
                try {
                    self->applyPart(parts.at(size_t(id - 1)));
                } catch (const std::exception &e) {
                    self->message(e.what());
                }
            });
    });
}
void Editor::exportGuitar() {
    std::vector<guitar::Part> parts;
    for (auto &row : book.sketches)
        if (!row.slots.empty()) {
            guitar::Part part{row.name, row.scale.tonic % 12, modes()[size_t(row.scale.mode)].guitarId, {}};
            for (auto &s : row.slots)
                if (!s.chord.pitches.empty())
                    part.chords.push_back({s.chord.name, s.chord.root % 12, s.chord.pitches});
            if (!part.chords.empty())
                parts.push_back(std::move(part));
        }
    if (parts.empty()) {
        message("Add at least one chord before exporting a guitar project.");
        return;
    }
    try {
        auto json = guitar::writeProject(parts);
        chooseFile("Save harmony as a Crest guitar project", "*.json", true, "Composer sketches.crest.json",
                   [this, json](const File &file) {
                       if (!file.replaceWithText(json))
                           throw std::runtime_error("Could not write guitar project.");
                       message(
                           "Saved harmony to guitar parts. Rests and performance timing stay in the MIDI export.");
                   });
    } catch (const std::exception &e) {
        message(e.what());
    }
}
} // namespace crest
