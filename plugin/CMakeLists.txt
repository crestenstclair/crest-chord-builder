cmake_minimum_required(VERSION 3.22)
if(CMAKE_HOST_APPLE AND NOT CMAKE_OSX_DEPLOYMENT_TARGET)
    set(CMAKE_OSX_DEPLOYMENT_TARGET "13.0" CACHE STRING "Minimum macOS version" FORCE)
endif()
project(CrestChordReference VERSION 1.0.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CREST_JUCE_SOURCE "" CACHE PATH "Optional local JUCE 8.0.12 checkout")
if(CREST_JUCE_SOURCE)
    set(CREST_JUCE_ROOT "${CREST_JUCE_SOURCE}")
    add_subdirectory("${CREST_JUCE_SOURCE}" juce EXCLUDE_FROM_ALL)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 29396c22c93392d6738e021b83196283d6e4d850 GIT_SHALLOW FALSE)
    FetchContent_MakeAvailable(JUCE)
    FetchContent_GetProperties(JUCE SOURCE_DIR CREST_JUCE_ROOT)
endif()
include(cmake/Licenses.cmake)

if(NOT EXISTS "${CMAKE_CURRENT_BINARY_DIR}/web.zip")
    message(FATAL_ERROR "Package the web assets first: npm run build:plugin")
endif()
juce_add_binary_data(ReferenceWebAssets HEADER_NAME ReferenceWebAssets.h NAMESPACE ReferenceWebAssets
    SOURCES "${CMAKE_CURRENT_BINARY_DIR}/web.zip")
juce_add_plugin(CrestChordReference
    COMPANY_NAME "Crest"
    BUNDLE_ID "com.crest.chord-reference"
    PLUGIN_MANUFACTURER_CODE Crst
    PLUGIN_CODE CcRf
    PRODUCT_NAME "Crest Chord Reference"
    FORMATS VST3
    VST3_CATEGORIES Fx Tools
    IS_SYNTH FALSE
    IS_MIDI_EFFECT FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE)
target_sources(CrestChordReference PRIVATE
    src/ReferenceState.cpp src/WebAssets.cpp src/PluginProcessor.cpp src/PluginEditor.cpp)
target_include_directories(CrestChordReference PUBLIC src)
target_compile_definitions(CrestChordReference PUBLIC
    JUCE_WEB_BROWSER=1 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0
    JUCE_REPORT_APP_USAGE=0)
target_link_libraries(CrestChordReference PRIVATE ReferenceWebAssets juce::juce_audio_utils juce::juce_gui_extra
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_warning_flags)

enable_testing()
juce_add_console_app(reference_state_tests PRODUCT_NAME "Chord Reference State Tests")
target_sources(reference_state_tests PRIVATE tests/state_tests.cpp src/ReferenceState.cpp)
target_include_directories(reference_state_tests PRIVATE src)
target_compile_definitions(reference_state_tests PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
target_link_libraries(reference_state_tests PRIVATE juce::juce_core)
add_test(NAME reference_state COMMAND reference_state_tests "${CMAKE_CURRENT_SOURCE_DIR}/../examples/first-idea.json")

juce_add_console_app(reference_native_tests PRODUCT_NAME "Chord Reference Native Tests")
target_sources(reference_native_tests PRIVATE tests/native_tests.cpp tests/web_tests.cpp)
get_target_property(native_test_definitions reference_native_tests COMPILE_DEFINITIONS)
list(REMOVE_ITEM native_test_definitions JUCE_STANDALONE_APPLICATION=1)
set_property(TARGET reference_native_tests PROPERTY COMPILE_DEFINITIONS "${native_test_definitions}")
target_compile_definitions(reference_native_tests PRIVATE JUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1 JUCE_MODAL_LOOPS_PERMITTED=1)
target_link_libraries(reference_native_tests PRIVATE CrestChordReference ReferenceWebAssets juce::juce_audio_utils juce::juce_gui_extra)
add_test(NAME reference_native COMMAND reference_native_tests "${CMAKE_CURRENT_SOURCE_DIR}/../examples/first-idea.json")
