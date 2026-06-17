import React, { useState, useEffect } from 'react'
import { Table, Select, Space, Card, Button, Row, Col, Statistic, Spin } from 'antd'
import { SearchOutlined, TeamOutlined, BookOutlined, TrophyOutlined, FileTextOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import request from '../../utils/request'

const { Option } = Select

export default function ReportSummary() {
  const [loading, setLoading] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'))

  const months = []
  for (let i = 0; i < 24; i++) {
    const date = dayjs().subtract(i, 'month')
    months.push({
      value: date.format('YYYY-MM'),
      label: date.format('YYYY年MM月')
    })
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await request.get('/reports/summary', {
        params: { month: selectedMonth }
      })
      setSummaryData(res.data || null)
    } finally {
      setLoading(false)
    }
  }

  const getBarOption = () => {
    if (!summaryData?.departments) return {}
    const departments = summaryData.departments.map(d => d.department)
    const completionRates = summaryData.departments.map(d => d.completion_rate || 0)
    const passRates = summaryData.departments.map(d => d.pass_rate || 0)

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      legend: {
        data: ['培训完成率', '考试合格率'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: departments,
        axisLabel: {
          interval: 0,
          rotate: 0
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%'
        }
      },
      series: [
        {
          name: '培训完成率',
          type: 'bar',
          data: completionRates,
          itemStyle: {
            color: '#1890ff'
          },
          barWidth: '30%',
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%'
          }
        },
        {
          name: '考试合格率',
          type: 'bar',
          data: passRates,
          itemStyle: {
            color: '#52c41a'
          },
          barWidth: '30%',
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%'
          }
        }
      ]
    }
  }

  const getPieOption = () => {
    if (!summaryData?.overview) return {}
    const { training_count, exam_count, certificate_count } = summaryData.overview

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'center'
      },
      series: [
        {
          name: '总体数据分布',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            formatter: '{b}: {c} ({d}%)'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold'
            }
          },
          data: [
            { value: training_count || 0, name: '培训人次', itemStyle: { color: '#1890ff' } },
            { value: exam_count || 0, name: '考试人次', itemStyle: { color: '#52c41a' } },
            { value: certificate_count || 0, name: '证书发放', itemStyle: { color: '#faad14' } }
          ]
        }
      ]
    }
  }

  const tableColumns = [
    { title: '部门', dataIndex: 'department', width: 120, fixed: 'left' },
    { title: '培训人次', dataIndex: 'training_count', width: 100 },
    { title: '完成人次', dataIndex: 'completed_count', width: 100 },
    {
      title: '培训完成率',
      dataIndex: 'completion_rate',
      width: 120,
      render: v => `${v || 0}%`
    },
    { title: '考试人次', dataIndex: 'exam_count', width: 100 },
    { title: '合格人次', dataIndex: 'passed_count', width: 100 },
    {
      title: '考试合格率',
      dataIndex: 'pass_rate',
      width: 120,
      render: v => `${v || 0}%`
    },
    { title: '证书发放量', dataIndex: 'certificate_count', width: 120 },
    { title: '总学时', dataIndex: 'total_hours', width: 100 }
  ]

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2 className="page-title">报告汇总</h2>
        </div>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h2 className="page-title">报告汇总</h2>
      </div>

      <Card>
        <Space style={{ marginBottom: 24 }} wrap>
          <Select
            placeholder="选择月份"
            style={{ width: 160 }}
            value={selectedMonth}
            onChange={setSelectedMonth}
          >
            {months.map(m => (
              <Option key={m.value} value={m.value}>{m.label}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadData}>查询</Button>
        </Space>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title={<span><TeamOutlined style={{ marginRight: 8, color: '#1890ff' }} />培训人次</span>}
                value={summaryData?.overview?.training_count || 0}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title={<span><BookOutlined style={{ marginRight: 8, color: '#52c41a' }} />考试人次</span>}
                value={summaryData?.overview?.exam_count || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title={<span><TrophyOutlined style={{ marginRight: 8, color: '#faad14' }} />证书发放</span>}
                value={summaryData?.overview?.certificate_count || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title={<span><FileTextOutlined style={{ marginRight: 8, color: '#722ed1' }} />平均完成率</span>}
                value={summaryData?.overview?.avg_completion_rate || 0}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={14}>
            <Card title="各部门完成率、合格率对比">
              <ReactECharts
                option={getBarOption()}
                style={{ height: 400 }}
                notMerge={true}
                lazyUpdate={true}
              />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="总体数据分布">
              <ReactECharts
                option={getPieOption()}
                style={{ height: 400 }}
                notMerge={true}
                lazyUpdate={true}
              />
            </Card>
          </Col>
        </Row>

        <Card title="各部门详细数据">
          <Table
            columns={tableColumns}
            dataSource={summaryData?.departments || []}
            rowKey="department"
            scroll={{ x: 1000 }}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: t => `共 ${t} 条`
            }}
          />
        </Card>
      </Card>
    </div>
  )
}
