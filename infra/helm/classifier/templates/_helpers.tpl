{{- define "classifier.labels" -}}
app.kubernetes.io/name: {{ .Release.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "classifier.image" -}}
{{- $svc := index . 1 -}}
{{- $root := index . 0 -}}
{{ $root.Values.image.registry }}/{{ $svc }}:{{ $root.Values.image.tag }}
{{- end -}}
