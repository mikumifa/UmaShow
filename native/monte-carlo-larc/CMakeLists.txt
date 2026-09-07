cmake_minimum_required(VERSION 3.21)

project(UmaShowMonteCarloLArc LANGUAGES CXX)

if(NOT WIN32)
  message(FATAL_ERROR "UmaShowMonteCarloLArc currently supports Windows only")
endif()

set(UMASHOW_ONNXRUNTIME_ROOT "" CACHE PATH "ONNX Runtime Windows x64 package root")
if(NOT UMASHOW_ONNXRUNTIME_ROOT)
  message(FATAL_ERROR "UMASHOW_ONNXRUNTIME_ROOT is required")
endif()

find_path(UMASHOW_ONNXRUNTIME_INCLUDE_DIR
  onnxruntime_cxx_api.h
  PATHS "${UMASHOW_ONNXRUNTIME_ROOT}/include"
  NO_DEFAULT_PATH
  REQUIRED
)
find_library(UMASHOW_ONNXRUNTIME_LIBRARY
  NAMES onnxruntime
  PATHS "${UMASHOW_ONNXRUNTIME_ROOT}/lib"
  NO_DEFAULT_PATH
  REQUIRED
)
find_file(UMASHOW_ONNXRUNTIME_DLL
  NAMES onnxruntime.dll
  PATHS "${UMASHOW_ONNXRUNTIME_ROOT}/lib"
  NO_DEFAULT_PATH
  REQUIRED
)

add_executable(UmaShowMonteCarloLArc
  External/mathFunctions.cpp
  External/utils.cpp
  GameDatabase/GameConfig.cpp
  GameDatabase/GameConstants.cpp
  GameDatabase/KnownSupportCards.cpp
  GameDatabase/KnownUmas.cpp
  GameDatabase/UmaData.cpp
  Graph/GraphFeatures.cpp
  Graph/GraphModel.cpp
  Graph/GraphSearch.cpp
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
target_include_directories(UmaShowMonteCarloLArc PRIVATE
  External
  "${UMASHOW_ONNXRUNTIME_INCLUDE_DIR}"
)
target_link_libraries(UmaShowMonteCarloLArc PRIVATE
  "${UMASHOW_ONNXRUNTIME_LIBRARY}"
)

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

add_custom_command(TARGET UmaShowMonteCarloLArc POST_BUILD
  COMMAND "${CMAKE_COMMAND}" -E copy_if_different
    "${UMASHOW_ONNXRUNTIME_DLL}"
    "${UMASHOW_NATIVE_OUTPUT}/onnxruntime.dll"
  VERBATIM
)
