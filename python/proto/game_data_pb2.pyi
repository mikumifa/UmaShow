from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class TargetType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    TARGET_TYPE_UNKNOWN: _ClassVar[TargetType]
    TARGET_TYPE_SPEED: _ClassVar[TargetType]
    TARGET_TYPE_STAMINA: _ClassVar[TargetType]
    TARGET_TYPE_POWER: _ClassVar[TargetType]
    TARGET_TYPE_GUTS: _ClassVar[TargetType]
    TARGET_TYPE_WIZ: _ClassVar[TargetType]
    TARGET_TYPE_VITAL: _ClassVar[TargetType]
    TARGET_TYPE_SKILL_PTS: _ClassVar[TargetType]
TARGET_TYPE_UNKNOWN: TargetType
TARGET_TYPE_SPEED: TargetType
TARGET_TYPE_STAMINA: TargetType
TARGET_TYPE_POWER: TargetType
TARGET_TYPE_GUTS: TargetType
TARGET_TYPE_WIZ: TargetType
TARGET_TYPE_VITAL: TargetType
TARGET_TYPE_SKILL_PTS: TargetType

class CharStat(_message.Message):
    __slots__ = ("value", "max")
    VALUE_FIELD_NUMBER: _ClassVar[int]
    MAX_FIELD_NUMBER: _ClassVar[int]
    value: int
    max: int
    def __init__(self, value: _Optional[int] = ..., max: _Optional[int] = ...) -> None: ...

class CharStats(_message.Message):
    __slots__ = ("speed", "stamina", "power", "wiz", "guts", "vital", "skill_point")
    SPEED_FIELD_NUMBER: _ClassVar[int]
    STAMINA_FIELD_NUMBER: _ClassVar[int]
    POWER_FIELD_NUMBER: _ClassVar[int]
    WIZ_FIELD_NUMBER: _ClassVar[int]
    GUTS_FIELD_NUMBER: _ClassVar[int]
    VITAL_FIELD_NUMBER: _ClassVar[int]
    SKILL_POINT_FIELD_NUMBER: _ClassVar[int]
    speed: CharStat
    stamina: CharStat
    power: CharStat
    wiz: CharStat
    guts: CharStat
    vital: CharStat
    skill_point: int
    def __init__(self, speed: _Optional[_Union[CharStat, _Mapping]] = ..., stamina: _Optional[_Union[CharStat, _Mapping]] = ..., power: _Optional[_Union[CharStat, _Mapping]] = ..., wiz: _Optional[_Union[CharStat, _Mapping]] = ..., guts: _Optional[_Union[CharStat, _Mapping]] = ..., vital: _Optional[_Union[CharStat, _Mapping]] = ..., skill_point: _Optional[int] = ...) -> None: ...

class GameStats(_message.Message):
    __slots__ = ("turn",)
    TURN_FIELD_NUMBER: _ClassVar[int]
    turn: int
    def __init__(self, turn: _Optional[int] = ...) -> None: ...

class CommandParam(_message.Message):
    __slots__ = ("target_type", "value")
    TARGET_TYPE_FIELD_NUMBER: _ClassVar[int]
    VALUE_FIELD_NUMBER: _ClassVar[int]
    target_type: TargetType
    value: int
    def __init__(self, target_type: _Optional[_Union[TargetType, str]] = ..., value: _Optional[int] = ...) -> None: ...

class TrainingCommand(_message.Message):
    __slots__ = ("command_id", "command_type", "is_enable", "failure_rate", "level", "training_partners", "tips_partners", "params")
    COMMAND_ID_FIELD_NUMBER: _ClassVar[int]
    COMMAND_TYPE_FIELD_NUMBER: _ClassVar[int]
    IS_ENABLE_FIELD_NUMBER: _ClassVar[int]
    FAILURE_RATE_FIELD_NUMBER: _ClassVar[int]
    LEVEL_FIELD_NUMBER: _ClassVar[int]
    TRAINING_PARTNERS_FIELD_NUMBER: _ClassVar[int]
    TIPS_PARTNERS_FIELD_NUMBER: _ClassVar[int]
    PARAMS_FIELD_NUMBER: _ClassVar[int]
    command_id: int
    command_type: int
    is_enable: int
    failure_rate: int
    level: int
    training_partners: _containers.RepeatedScalarFieldContainer[int]
    tips_partners: _containers.RepeatedScalarFieldContainer[int]
    params: _containers.RepeatedCompositeFieldContainer[CommandParam]
    def __init__(self, command_id: _Optional[int] = ..., command_type: _Optional[int] = ..., is_enable: _Optional[int] = ..., failure_rate: _Optional[int] = ..., level: _Optional[int] = ..., training_partners: _Optional[_Iterable[int]] = ..., tips_partners: _Optional[_Iterable[int]] = ..., params: _Optional[_Iterable[_Union[CommandParam, _Mapping]]] = ...) -> None: ...

class PartnerStat(_message.Message):
    __slots__ = ("position", "support_card_id", "chara_path", "evaluation", "limit_break", "exp")
    POSITION_FIELD_NUMBER: _ClassVar[int]
    SUPPORT_CARD_ID_FIELD_NUMBER: _ClassVar[int]
    CHARA_PATH_FIELD_NUMBER: _ClassVar[int]
    EVALUATION_FIELD_NUMBER: _ClassVar[int]
    LIMIT_BREAK_FIELD_NUMBER: _ClassVar[int]
    EXP_FIELD_NUMBER: _ClassVar[int]
    position: int
    support_card_id: int
    chara_path: str
    evaluation: int
    limit_break: int
    exp: int
    def __init__(self, position: _Optional[int] = ..., support_card_id: _Optional[int] = ..., chara_path: _Optional[str] = ..., evaluation: _Optional[int] = ..., limit_break: _Optional[int] = ..., exp: _Optional[int] = ...) -> None: ...

class EventOption(_message.Message):
    __slots__ = ("desp", "detail", "type")
    class EventOptionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
        __slots__ = ()
        UNKNOWN: _ClassVar[EventOption.EventOptionType]
        CORRECT: _ClassVar[EventOption.EventOptionType]
        WRONG: _ClassVar[EventOption.EventOptionType]
        NEUTRAL: _ClassVar[EventOption.EventOptionType]
    UNKNOWN: EventOption.EventOptionType
    CORRECT: EventOption.EventOptionType
    WRONG: EventOption.EventOptionType
    NEUTRAL: EventOption.EventOptionType
    DESP_FIELD_NUMBER: _ClassVar[int]
    DETAIL_FIELD_NUMBER: _ClassVar[int]
    TYPE_FIELD_NUMBER: _ClassVar[int]
    desp: str
    detail: str
    type: EventOption.EventOptionType
    def __init__(self, desp: _Optional[str] = ..., detail: _Optional[str] = ..., type: _Optional[_Union[EventOption.EventOptionType, str]] = ...) -> None: ...

class GameEvent(_message.Message):
    __slots__ = ("event_id", "event_name", "options")
    EVENT_ID_FIELD_NUMBER: _ClassVar[int]
    EVENT_NAME_FIELD_NUMBER: _ClassVar[int]
    OPTIONS_FIELD_NUMBER: _ClassVar[int]
    event_id: int
    event_name: str
    options: _containers.RepeatedCompositeFieldContainer[EventOption]
    def __init__(self, event_id: _Optional[int] = ..., event_name: _Optional[str] = ..., options: _Optional[_Iterable[_Union[EventOption, _Mapping]]] = ...) -> None: ...

class CharInfo(_message.Message):
    __slots__ = ("partner_stats", "game_events", "game_stats", "stats", "commands")
    PARTNER_STATS_FIELD_NUMBER: _ClassVar[int]
    GAME_EVENTS_FIELD_NUMBER: _ClassVar[int]
    GAME_STATS_FIELD_NUMBER: _ClassVar[int]
    STATS_FIELD_NUMBER: _ClassVar[int]
    COMMANDS_FIELD_NUMBER: _ClassVar[int]
    partner_stats: _containers.RepeatedCompositeFieldContainer[PartnerStat]
    game_events: _containers.RepeatedCompositeFieldContainer[GameEvent]
    game_stats: GameStats
    stats: CharStats
    commands: _containers.RepeatedCompositeFieldContainer[TrainingCommand]
    def __init__(self, partner_stats: _Optional[_Iterable[_Union[PartnerStat, _Mapping]]] = ..., game_events: _Optional[_Iterable[_Union[GameEvent, _Mapping]]] = ..., game_stats: _Optional[_Union[GameStats, _Mapping]] = ..., stats: _Optional[_Union[CharStats, _Mapping]] = ..., commands: _Optional[_Iterable[_Union[TrainingCommand, _Mapping]]] = ...) -> None: ...

class RaceMetaInfo(_message.Message):
    __slots__ = ("race_instance_id", "season", "weather", "ground_condition", "random_seed", "entry_num", "current_entry_num", "extra")
    class ExtraEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: _struct_pb2.Value
        def __init__(self, key: _Optional[str] = ..., value: _Optional[_Union[_struct_pb2.Value, _Mapping]] = ...) -> None: ...
    RACE_INSTANCE_ID_FIELD_NUMBER: _ClassVar[int]
    SEASON_FIELD_NUMBER: _ClassVar[int]
    WEATHER_FIELD_NUMBER: _ClassVar[int]
    GROUND_CONDITION_FIELD_NUMBER: _ClassVar[int]
    RANDOM_SEED_FIELD_NUMBER: _ClassVar[int]
    ENTRY_NUM_FIELD_NUMBER: _ClassVar[int]
    CURRENT_ENTRY_NUM_FIELD_NUMBER: _ClassVar[int]
    EXTRA_FIELD_NUMBER: _ClassVar[int]
    race_instance_id: int
    season: int
    weather: int
    ground_condition: int
    random_seed: int
    entry_num: int
    current_entry_num: int
    extra: _containers.MessageMap[str, _struct_pb2.Value]
    def __init__(self, race_instance_id: _Optional[int] = ..., season: _Optional[int] = ..., weather: _Optional[int] = ..., ground_condition: _Optional[int] = ..., random_seed: _Optional[int] = ..., entry_num: _Optional[int] = ..., current_entry_num: _Optional[int] = ..., extra: _Optional[_Mapping[str, _struct_pb2.Value]] = ...) -> None: ...

class RaceHorseInfo(_message.Message):
    __slots__ = ("payload",)
    PAYLOAD_FIELD_NUMBER: _ClassVar[int]
    payload: _struct_pb2.Struct
    def __init__(self, payload: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class RaceRecord(_message.Message):
    __slots__ = ("filename", "full_path", "created_at", "race_meta_info", "scenario", "horses")
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    FULL_PATH_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    RACE_META_INFO_FIELD_NUMBER: _ClassVar[int]
    SCENARIO_FIELD_NUMBER: _ClassVar[int]
    HORSES_FIELD_NUMBER: _ClassVar[int]
    filename: str
    full_path: str
    created_at: str
    race_meta_info: RaceMetaInfo
    scenario: str
    horses: _containers.RepeatedCompositeFieldContainer[RaceHorseInfo]
    def __init__(self, filename: _Optional[str] = ..., full_path: _Optional[str] = ..., created_at: _Optional[str] = ..., race_meta_info: _Optional[_Union[RaceMetaInfo, _Mapping]] = ..., scenario: _Optional[str] = ..., horses: _Optional[_Iterable[_Union[RaceHorseInfo, _Mapping]]] = ...) -> None: ...
