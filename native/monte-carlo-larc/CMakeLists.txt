cmake_minimum_required(VERSION 3.21)

project(UmaShowMonteCarloLArc LANGUAGES CXX)

if(NOT WIN32 AND NOT UNIX)
  message(FATAL_ERROR "UmaShowMonteCarloLArc supports Windows and Linux only")
endif()

set(UMASHOW_ONNXRUNTIME_ROOT "" CACHE PATH "ONNX Runtime package root")
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

if(WIN32)
  find_file(UMASHOW_ONNXRUNTIME_DLL
    NAMES onnxruntime.dll
    PATHS "${UMASHOW_ONNXRUNTIME_ROOT}/lib"
    NO_DEFAULT_PATH
    REQUIRED
  )
  set(UMASHOW_ONNXRUNTIME_RUNTIME_FILES "${UMASHOW_ONNXRUNTIME_DLL}")
else()
  file(GLOB UMASHOW_ONNXRUNTIME_RUNTIME_FILES
    LIST_DIRECTORIES FALSE
    "${UMASHOW_ONNXRUNTIME_ROOT}/lib/libonnxruntime.so*"
  )
  if(NOT UMASHOW_ONNXRUNTIME_RUNTIME_FILES)
    message(FATAL_ERROR
      "No libonnxruntime.so runtime files found under ${UMASHOW_ONNXRUNTIME_ROOT}/lib"
    )
  endif()
endif()

find_package(Threads REQUIRED)

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

target_compile_features(UmaShowMonteCarloLArc PRIVATE cxx_std_17)
if(WIN32)
  target_compile_definitions(UmaShowMonteCarloLArc PRIVATE
    NOMINMAX
    _CONSOLE
    UNICODE
    _UNICODE
  )
endif()
target_include_directories(UmaShowMonteCarloLArc PRIVATE
  External
  "${UMASHOW_ONNXRUNTIME_INCLUDE_DIR}"
)
target_link_libraries(UmaShowMonteCarloLArc PRIVATE
  "${UMASHOW_ONNXRUNTIME_LIBRARY}"
  Threads::Threads
)

if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU" AND
   CMAKE_CXX_COMPILER_VERSION VERSION_LESS 9)
  target_link_libraries(UmaShowMonteCarloLArc PRIVATE stdc++fs)
endif()

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
elseif(UNIX)
  target_compile_options(UmaShowMonteCarloLArc PRIVATE
    -Wall
    -Wextra
    -Wno-unused-parameter
  )
  set_target_properties(UmaShowMonteCarloLArc PROPERTIES
    BUILD_RPATH "$ORIGIN"
    INSTALL_RPATH "$ORIGIN"
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

foreach(UMASHOW_ONNXRUNTIME_RUNTIME_FILE IN LISTS UMASHOW_ONNXRUNTIME_RUNTIME_FILES)
  get_filename_component(
    UMASHOW_ONNXRUNTIME_RUNTIME_NAME
    "${UMASHOW_ONNXRUNTIME_RUNTIME_FILE}"
    NAME
  )
  add_custom_command(TARGET UmaShowMonteCarloLArc POST_BUILD
    COMMAND "${CMAKE_COMMAND}" -E copy_if_different
      "${UMASHOW_ONNXRUNTIME_RUNTIME_FILE}"
      "${UMASHOW_NATIVE_OUTPUT}/${UMASHOW_ONNXRUNTIME_RUNTIME_NAME}"
    VERBATIM
  )
endforeach()
