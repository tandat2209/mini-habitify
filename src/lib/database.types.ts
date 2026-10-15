export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_template_versions: {
        Row: {
          created_at: string;
          fields: NonNullable<Json>;
          id: string;
          template_id: string;
          user_id: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          fields: NonNullable<Json>;
          id?: string;
          template_id: string;
          user_id: string;
          version: number;
        };
        Update: {
          created_at?: string;
          fields?: NonNullable<Json>;
          id?: string;
          template_id?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activity_template_versions_template_id_user_id_fkey";
            columns: ["template_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "activity_templates";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "activity_template_versions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_templates: {
        Row: {
          created_at: string;
          current_version_id: string | null;
          description: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          current_version_id?: string | null;
          description?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_templates_current_version_id_id_user_id_fkey";
            columns: ["current_version_id", "id", "user_id"];
            isOneToOne: false;
            referencedRelation: "activity_template_versions";
            referencedColumns: ["id", "template_id", "user_id"];
          },
          {
            foreignKeyName: "activity_templates_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dashboard_widgets: {
        Row: {
          enabled: boolean;
          id: string;
          kind: string;
          position: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          enabled?: boolean;
          id?: string;
          kind: string;
          position?: number;
          user_id: string;
        };
        Update: {
          enabled?: boolean;
          id?: string;
          kind?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      themes: {
        Row: {
          id: string;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          id: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      tracker_logs: {
        Row: {
          created_at: string;
          details: NonNullable<Json>;
          id: string;
          template_version_id: string | null;
          tracker_id: string;
          tracker_type: string;
          tracking_date: string;
          user_id: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          template_version_id?: string | null;
          tracker_id: string;
          tracker_type: string;
          tracking_date: string;
          user_id: string;
          value: number;
        };
        Update: {
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          template_version_id?: string | null;
          tracker_id?: string;
          tracker_type?: string;
          tracking_date?: string;
          user_id?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "tracker_logs_template_version_id_user_id_fkey";
            columns: ["template_version_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "activity_template_versions";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "tracker_logs_tracker_id_user_id_tracker_type_fkey";
            columns: ["tracker_id", "user_id", "tracker_type"];
            isOneToOne: false;
            referencedRelation: "trackers";
            referencedColumns: ["id", "user_id", "type"];
          },
          {
            foreignKeyName: "tracker_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      trackers: {
        Row: {
          activity_template_id: string | null;
          archived_at: string | null;
          color: string;
          created_at: string;
          description: string;
          goal_period: string;
          icon: string;
          id: string;
          name: string;
          schedule: number[];
          target: number | null;
          type: string;
          unit: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_template_id?: string | null;
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          description?: string;
          goal_period?: string;
          icon?: string;
          id?: string;
          name: string;
          schedule?: number[];
          target?: number | null;
          type?: string;
          unit?: string;
          user_id: string;
        };
        Update: {
          activity_template_id?: string | null;
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          description?: string;
          goal_period?: string;
          icon?: string;
          id?: string;
          name?: string;
          schedule?: number[];
          target?: number | null;
          type?: string;
          unit?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trackers_activity_template_id_user_id_fkey";
            columns: ["activity_template_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "activity_templates";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "trackers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          layout: string;
          presentation: string;
          primary_color: string | null;
          theme: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          layout?: string;
          presentation?: string;
          primary_color?: string | null;
          theme?: string;
          user_id: string;
        };
        Update: {
          layout?: string;
          presentation?: string;
          primary_color?: string | null;
          theme?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_theme_fkey";
            columns: ["theme"];
            isOneToOne: false;
            referencedRelation: "themes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activity_content_trim: { Args: { p_text: string }; Returns: string };
      publish_activity_template: {
        Args: {
          p_description?: string;
          p_fields?: Json;
          p_name?: string;
          p_template?: string;
        };
        Returns: string;
      };
      record_log: {
        Args: {
          p_date: string;
          p_id: string;
          p_tracker: string;
          p_value: number;
        };
        Returns: undefined;
      };
      record_log_with_details: {
        Args: {
          p_date: string;
          p_details?: Json;
          p_id: string;
          p_template_version?: string;
          p_tracker: string;
          p_value: number;
        };
        Returns: string;
      };
      save_appearance: {
        Args: {
          p_layout: string;
          p_presentation: string;
          p_show_activity: boolean;
          p_theme: string;
        };
        Returns: undefined;
      };
      save_dashboard_appearance: {
        Args: {
          p_layout: string;
          p_presentation: string;
          p_theme: string;
          p_widgets: Json;
        };
        Returns: undefined;
      };
      save_dashboard_appearance_with_color: {
        Args: {
          p_layout: string;
          p_presentation: string;
          p_primary_color?: string;
          p_theme: string;
          p_widgets: Json;
        };
        Returns: undefined;
      };
      validate_activity_details: {
        Args: { p_details: Json; p_fields: Json };
        Returns: undefined;
      };
      validate_template_fields: {
        Args: { p_fields: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
