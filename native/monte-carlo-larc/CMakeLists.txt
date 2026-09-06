cmake_minimum_required(VERSION 3.21)

project(UmaShowMonteCarloLArc LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "UmaShowMonteCarloLArc currently supports Windows only")
endif()

add_executable(UmaShowMonteCarloLArc
  External/mathFunctions.cpp
  External/utils.cpp
  GameDatabase/GameConfig.cpp
  GameDatabase/GameConstants.cpp
  GameDatabase/KnownSupportCards.cpp
  GameDatabase/KnownUmas.cpp
  GameDatabase/UmaData.cpp
  Game/Action.cpp
  Game/Game.cpp
  Game/GamePrint.cpp
  Game/Person.cpp
  Game/Protocol.cpp
  NeuralNet/Evaluator.cpp
  NeuralNet/Model.cpp
  NeuralNet/Model_noNN.cpp
  NeuralNet/NNInput.cpp
  NeuralNet/TrainingSample.cpp
  Search/Search.cpp
  Search/SearchParam.cpp
  SupportCard/CardEffect.cpp
  SupportCard/SupportCard.cpp
  UmaShowLArcBridge.cpp
)

target_compile_features(UmaShowMonteCarloLArc PRIVATE cxx_std_20)
target_compile_definitions(UmaShowMonteCarloLArc PRIVATE
  NOMINMAX
  _CONSOLE
  UNICODE
  _UNICODE
)
target_include_directories(UmaShowMonteCarloLArc PRIVATE External)

if(MSVC)
  target_compile_options(UmaShowMonteCarloLArc PRIVATE
    /W3
    /sdl-
    /utf-8
    /Zc:__cplusplus
  )
  set_property(TARGET UmaShowMonteCarloLArc PROPERTY
    MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>"
  )
  set_property(TARGET UmaShowMonteCarloLArc PROPERTY
    INTERPROCEDURAL_OPTIMIZATION_RELEASE TRUE
  )
endif()

set(UMASHOW_NATIVE_OUTPUT "${CMAKE_CURRENT_SOURCE_DIR}/../../assets/native")
set_target_properties(UmaShowMonteCarloLArc PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY "${UMASHOW_NATIVE_OUTPUT}"
  RUNTIME_OUTPUT_DIRECTORY_DEBUG "${UMASHOW_NATIVE_OUTPUT}"
  RUNTIME_OUTPUT_DIRECTORY_RELEASE "${UMASHOW_NATIVE_OUTPUT}"
  RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO "${UMASHOW_NATIVE_OUTPUT}"
  RUNTIME_OUTPUT_DIRECTORY_MINSIZEREL "${UMASHOW_NATIVE_OUTPUT}"
)
